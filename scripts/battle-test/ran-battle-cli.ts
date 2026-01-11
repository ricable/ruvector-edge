#!/usr/bin/env bun
/**
 * RAN Agent Battle Arena - Interactive CLI Demo
 *
 * Combines 300 questions (250 + 50) from two question sets with interactive
 * browsing, real-time agent responses, and session statistics.
 *
 * Features:
 * - Browse by Category (A: Knowledge, B: Decision, C: Advanced)
 * - Browse by Feature (50 LTE features)
 * - Random Challenge mode
 * - Full Battle Test mode
 * - Search Questions
 *
 * @module scripts/battle-test/ran-battle-cli
 */

import * as readline from 'readline';
import { LTEFeatureAgentsFactory, type EnhancedFeatureAgent } from '../../src/domains/knowledge/aggregates/enhanced-feature-agent';
import {
  TestQuestion,
  QuestionCategory,
  QuestionType,
  ComplexityLevel,
  DefaultQuestionBank,
  QuestionBankLoader,
  BattleTest,
  TestMode,
} from '../../src/domains/ran-battle-test';
import { LTE_50_FEATURES } from '../../src/domains/ran-battle-test/aggregates/lte-features-constants';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// Types
interface BattleQuestion {
  id: string;
  questionNumber: number;
  category: 'A' | 'B' | 'C';
  categoryName: string;
  type: string;
  featureAcronym: string;
  featureFAJ: string;
  featureName: string;
  content: string;
  complexity: string;
  points: number;
  source: '250' | '50';
}

interface SessionState {
  questionsAnswered: number;
  totalScore: number;
  maxPossibleScore: number;
  categoryScores: Record<string, { earned: number; max: number }>;
  featureScores: Record<string, { earned: number; max: number; questions: number }>;
  startTime: number;
  responseTimes: number[];
}

interface AgentResponse {
  success: boolean;
  response: string;
  confidence: number;
  action: string;
  latency: number;
  state: string;
  qValue?: number;
}

// CLI class
class RANBattleCLI {
  private rl: readline.Interface;
  private questions250: BattleQuestion[] = [];
  private questions50: BattleQuestion[] = [];
  private allQuestions: BattleQuestion[] = [];
  private agents: Map<string, EnhancedFeatureAgent> = new Map();
  private session: SessionState;
  private initialized = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.session = {
      questionsAnswered: 0,
      totalScore: 0,
      maxPossibleScore: 0,
      categoryScores: {
        A: { earned: 0, max: 0 },
        B: { earned: 0, max: 0 },
        C: { earned: 0, max: 0 },
      },
      featureScores: {},
      startTime: Date.now(),
      responseTimes: [],
    };
  }

  // Prompt helper
  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => resolve(answer.trim()));
    });
  }

  // Clear screen
  private clearScreen(): void {
    console.clear();
  }

  // Display header
  private displayHeader(): void {
    console.log('');
    console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}${colors.bold}          RAN Agent Battle Arena - Interactive Demo                          ${colors.reset}${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}          ${colors.dim}300 Questions | 50 Features | 50 Specialized Agents${colors.reset}                ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
  }

  // Load questions from markdown
  private loadQuestionsFromMarkdown(content: string, source: '250' | '50'): BattleQuestion[] {
    const questions: BattleQuestion[] = [];
    const lines = content.split('\n');

    let currentFeatureAcronym = '';
    let currentFeatureFAJ = '';
    let currentFeatureName = '';
    let questionNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Feature header - both formats
      if (line.startsWith('## ') && (line.includes('FAJ') || line.includes('-'))) {
        // Format: "## 1. MSM - MIMO Sleep Mode (FAJ 121 3094)"
        const match = line.match(/## (\d+)\.\s+(\w+)\s+-\s+([^(]+)\s*\(FAJ\s+([^)]+)\)/);
        if (match) {
          currentFeatureAcronym = match[2];
          currentFeatureName = match[3].trim();
          currentFeatureFAJ = `FAJ ${match[4]}`;
        } else {
          // Try simpler format: "### Cell Capacity & Configuration"
          const simpleMatch = line.match(/##\s+(.+)/);
          if (simpleMatch) {
            currentFeatureName = simpleMatch[1];
          }
        }
      }

      // Question header (e.g., "### Q1-MSM-K01" or numbered list)
      if (line.startsWith('### Q') || (line.match(/^\d+\.\s+\*\*(\w+)/) && line.includes('**'))) {
        let qMatch = line.match(/### Q(\d+)-(\w+)-(K\d+|D\d+|A\d+)/);

        // Handle numbered format from 50-questions: "1. **11CS (13-18 Cell Support)**: "
        if (!qMatch) {
          const numberedMatch = line.match(/^(\d+)\.\s+\*\*(\w+)\s+\(([^)]+)\)\*\*:\s*"(.+)"/);
          if (numberedMatch) {
            questionNumber++;
            const acronym = numberedMatch[2];
            const name = numberedMatch[3];
            const content = numberedMatch[4];

            // Find FAJ from features
            const feature = LTE_50_FEATURES.find(f => f.acronym === acronym);

            questions.push({
              id: `Q${questionNumber}-${acronym}-EXT`,
              questionNumber,
              category: questionNumber <= 20 ? 'A' : questionNumber <= 35 ? 'B' : 'C',
              categoryName: questionNumber <= 20 ? 'Knowledge' : questionNumber <= 35 ? 'Decision' : 'Advanced',
              type: 'EXTENDED',
              featureAcronym: acronym,
              featureFAJ: feature?.faj || '',
              featureName: name,
              content,
              complexity: 'MODERATE',
              points: questionNumber <= 20 ? 5 : questionNumber <= 35 ? 8 : 10,
              source,
            });
            continue;
          }
        }

        if (qMatch) {
          const qNumber = parseInt(qMatch[1], 10);
          const acronym = qMatch[2];
          const typeStr = qMatch[3];

          // Determine category
          let category: 'A' | 'B' | 'C';
          let categoryName: string;
          let points: number;

          if (typeStr.startsWith('K')) {
            category = 'A';
            categoryName = 'Knowledge';
            points = 5;
          } else if (typeStr.startsWith('D')) {
            category = 'B';
            categoryName = 'Decision';
            points = 8;
          } else {
            category = 'C';
            categoryName = 'Advanced';
            points = 10;
          }

          // Extract question content (next non-empty line with quotes)
          let content = '';
          let j = i + 1;
          while (j < lines.length && !lines[j].trim().startsWith('"')) {
            j++;
          }
          if (j < lines.length) {
            content = lines[j].trim().replace(/^"|"$/g, '');
          }

          if (content) {
            questions.push({
              id: `Q${qNumber}-${acronym}-${typeStr}`,
              questionNumber: qNumber,
              category,
              categoryName,
              type: typeStr,
              featureAcronym: acronym,
              featureFAJ: currentFeatureFAJ,
              featureName: currentFeatureName,
              content,
              complexity: category === 'C' ? 'EXPERT' : 'MODERATE',
              points,
              source,
            });
          }
        }
      }
    }

    return questions;
  }

  // Initialize
  async initialize(): Promise<void> {
    console.log('');
    console.log(`${colors.yellow}⏳ Initializing RAN Battle Arena...${colors.reset}`);

    // Load question files
    console.log('  📝 Loading question sets...');

    try {
      const q250Path = `${import.meta.dir}/../../docs/ran-250-questions.md`;
      const q50Path = `${import.meta.dir}/../../docs/ran-agent-questions.md`;

      const content250 = await Bun.file(q250Path).text();
      const content50 = await Bun.file(q50Path).text();

      this.questions250 = this.loadQuestionsFromMarkdown(content250, '250');
      this.questions50 = this.loadQuestionsFromMarkdown(content50, '50');

      // If parsing didn't work, use the framework's question loader
      if (this.questions250.length === 0) {
        console.log('  📝 Using framework question loader...');
        const frameworkQuestions = QuestionBankLoader.createDefaultQuestions();
        this.questions250 = frameworkQuestions.map((q, idx) => ({
          id: `Q${idx + 1}-${q.featureAcronym}-${q.type}`,
          questionNumber: idx + 1,
          category: q.category === QuestionCategory.KNOWLEDGE ? 'A' as const :
                    q.category === QuestionCategory.DECISION ? 'B' as const : 'C' as const,
          categoryName: q.category === QuestionCategory.KNOWLEDGE ? 'Knowledge' :
                        q.category === QuestionCategory.DECISION ? 'Decision' : 'Advanced',
          type: q.type.toString(),
          featureAcronym: q.featureAcronym,
          featureFAJ: q.featureFAJ,
          featureName: q.featureName,
          content: q.content,
          complexity: q.complexity.toString(),
          points: q.points,
          source: '250' as const,
        }));
      }

      // Generate 50 additional questions if parsing didn't work
      if (this.questions50.length === 0) {
        this.questions50 = LTE_50_FEATURES.map((f, idx) => ({
          id: `Q${idx + 1}-${f.acronym}-EXT`,
          questionNumber: idx + 1,
          category: idx < 20 ? 'A' as const : idx < 35 ? 'B' as const : 'C' as const,
          categoryName: idx < 20 ? 'Knowledge' : idx < 35 ? 'Decision' : 'Advanced',
          type: 'EXTENDED',
          featureAcronym: f.acronym,
          featureFAJ: f.faj,
          featureName: f.name,
          content: `Explain ${f.name} (${f.acronym}) and its impact on network performance.`,
          complexity: 'MODERATE',
          points: idx < 20 ? 5 : idx < 35 ? 8 : 10,
          source: '50' as const,
        }));
      }

      this.allQuestions = [...this.questions250, ...this.questions50];
      console.log(`     ✓ Loaded ${this.questions250.length} questions from 250-set`);
      console.log(`     ✓ Loaded ${this.questions50.length} questions from 50-set`);
      console.log(`     ✓ Total: ${this.allQuestions.length} questions`);

    } catch (error) {
      console.log(`  ${colors.yellow}⚠️  Using framework-generated questions${colors.reset}`);
      const frameworkQuestions = QuestionBankLoader.createDefaultQuestions();
      this.questions250 = frameworkQuestions.map((q, idx) => ({
        id: `Q${idx + 1}-${q.featureAcronym}-${q.type}`,
        questionNumber: idx + 1,
        category: q.category === QuestionCategory.KNOWLEDGE ? 'A' as const :
                  q.category === QuestionCategory.DECISION ? 'B' as const : 'C' as const,
        categoryName: q.category === QuestionCategory.KNOWLEDGE ? 'Knowledge' :
                      q.category === QuestionCategory.DECISION ? 'Decision' : 'Advanced',
        type: q.type.toString(),
        featureAcronym: q.featureAcronym,
        featureFAJ: q.featureFAJ,
        featureName: q.featureName,
        content: q.content,
        complexity: q.complexity.toString(),
        points: q.points,
        source: '250' as const,
      }));
      this.allQuestions = this.questions250;
    }

    // Create and initialize agents
    console.log('  🤖 Creating 50 specialized RAN agents...');
    this.agents = LTEFeatureAgentsFactory.createAll();
    console.log(`     ✓ Created ${this.agents.size} agents`);

    console.log('  ⚡ Initializing agents (loading knowledge)...');
    let initCount = 0;
    for (const [acronym, agent] of this.agents) {
      try {
        await agent.initialize();
        initCount++;
        if (initCount % 10 === 0) {
          process.stdout.write(`\r     ${initCount}/${this.agents.size} agents initialized`);
        }
      } catch {
        // Agent failed to initialize, continue
      }
    }
    console.log(`\n     ✓ ${initCount} agents ready`);

    this.initialized = true;
    console.log('');
    console.log(`${colors.green}✅ Battle Arena Ready!${colors.reset}`);
    console.log('');
  }

  // Display main menu
  private async showMainMenu(): Promise<string> {
    console.log(`${colors.bold}Select Mode:${colors.reset}`);
    console.log('');
    console.log(`  ${colors.cyan}[1]${colors.reset} Browse by Category (A: Knowledge, B: Decision, C: Advanced)`);
    console.log(`  ${colors.cyan}[2]${colors.reset} Browse by Feature (50 LTE features)`);
    console.log(`  ${colors.cyan}[3]${colors.reset} Random Challenge`);
    console.log(`  ${colors.cyan}[4]${colors.reset} Full Battle Test`);
    console.log(`  ${colors.cyan}[5]${colors.reset} Search Questions`);
    console.log(`  ${colors.cyan}[S]${colors.reset} Session Statistics`);
    console.log(`  ${colors.cyan}[Q]${colors.reset} Quit`);
    console.log('');

    const choice = await this.prompt(`${colors.yellow}> ${colors.reset}`);
    return choice.toLowerCase();
  }

  // Browse by category
  private async browseByCategory(): Promise<void> {
    this.clearScreen();
    this.displayHeader();

    console.log(`${colors.bold}Select Category:${colors.reset}`);
    console.log('');

    const catA = this.allQuestions.filter(q => q.category === 'A');
    const catB = this.allQuestions.filter(q => q.category === 'B');
    const catC = this.allQuestions.filter(q => q.category === 'C');

    console.log(`  ${colors.green}[A]${colors.reset} Knowledge Retrieval (${catA.length} questions)`);
    console.log(`      ${colors.dim}Tests feature-specific knowledge, parameters, counters${colors.reset}`);
    console.log('');
    console.log(`  ${colors.yellow}[B]${colors.reset} Decision Making (${catB.length} questions)`);
    console.log(`      ${colors.dim}Tests optimization decisions, activation criteria${colors.reset}`);
    console.log('');
    console.log(`  ${colors.red}[C]${colors.reset} Advanced Troubleshooting (${catC.length} questions)`);
    console.log(`      ${colors.dim}Tests complex scenarios, root cause analysis${colors.reset}`);
    console.log('');
    console.log(`  ${colors.dim}[B]ack${colors.reset}`);
    console.log('');

    const choice = (await this.prompt(`${colors.yellow}> ${colors.reset}`)).toUpperCase();

    if (choice === 'B' || choice === 'BACK') return;

    let questions: BattleQuestion[] = [];
    let categoryName = '';

    if (choice === 'A') {
      questions = catA;
      categoryName = 'Knowledge (A)';
    } else if (choice === 'B') {
      questions = catB;
      categoryName = 'Decision (B)';
    } else if (choice === 'C') {
      questions = catC;
      categoryName = 'Advanced (C)';
    }

    if (questions.length > 0) {
      await this.browseQuestions(questions, categoryName);
    }
  }

  // Browse by feature
  private async browseByFeature(): Promise<void> {
    this.clearScreen();
    this.displayHeader();

    console.log(`${colors.bold}Select Feature:${colors.reset}`);
    console.log('');

    // Group questions by feature
    const featureMap = new Map<string, BattleQuestion[]>();
    for (const q of this.allQuestions) {
      const existing = featureMap.get(q.featureAcronym) || [];
      existing.push(q);
      featureMap.set(q.featureAcronym, existing);
    }

    // Display features in columns
    const features = Array.from(featureMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const cols = 3;
    const rows = Math.ceil(features.length / cols);

    for (let row = 0; row < rows; row++) {
      let line = '  ';
      for (let col = 0; col < cols; col++) {
        const idx = col * rows + row;
        if (idx < features.length) {
          const [acronym, qs] = features[idx];
          const display = `[${acronym}] (${qs.length})`.padEnd(25);
          line += display;
        }
      }
      console.log(line);
    }

    console.log('');
    console.log(`  ${colors.dim}Enter feature acronym or [B]ack${colors.reset}`);
    console.log('');

    const choice = (await this.prompt(`${colors.yellow}> ${colors.reset}`)).toUpperCase();

    if (choice === 'B' || choice === 'BACK') return;

    const questions = featureMap.get(choice);
    if (questions && questions.length > 0) {
      const feature = LTE_50_FEATURES.find(f => f.acronym === choice);
      const featureName = feature ? `${choice} - ${feature.name}` : choice;
      await this.browseQuestions(questions, featureName);
    } else {
      console.log(`${colors.red}Feature not found: ${choice}${colors.reset}`);
      await this.prompt('Press Enter to continue...');
    }
  }

  // Browse questions list
  private async browseQuestions(questions: BattleQuestion[], title: string): Promise<void> {
    const pageSize = 10;
    let page = 0;

    while (true) {
      this.clearScreen();
      this.displayHeader();

      console.log(`${colors.bold}${title}${colors.reset} - ${questions.length} questions`);
      console.log('');

      const start = page * pageSize;
      const end = Math.min(start + pageSize, questions.length);
      const pageQuestions = questions.slice(start, end);

      for (let i = 0; i < pageQuestions.length; i++) {
        const q = pageQuestions[i];
        const num = (start + i + 1).toString().padStart(3);
        const cat = q.category === 'A' ? colors.green : q.category === 'B' ? colors.yellow : colors.red;
        const contentPreview = q.content.substring(0, 60) + (q.content.length > 60 ? '...' : '');
        console.log(`  ${colors.cyan}[${num}]${colors.reset} ${cat}[${q.category}]${colors.reset} ${q.featureAcronym.padEnd(8)} ${contentPreview}`);
      }

      console.log('');
      console.log(`  ${colors.dim}Page ${page + 1}/${Math.ceil(questions.length / pageSize)}${colors.reset}`);
      console.log(`  ${colors.dim}[N]ext [P]rev [B]ack | Enter number to run question${colors.reset}`);
      console.log('');

      const choice = (await this.prompt(`${colors.yellow}> ${colors.reset}`)).toUpperCase();

      if (choice === 'B' || choice === 'BACK') break;
      if (choice === 'N' || choice === 'NEXT') {
        if ((page + 1) * pageSize < questions.length) page++;
        continue;
      }
      if (choice === 'P' || choice === 'PREV') {
        if (page > 0) page--;
        continue;
      }

      const num = parseInt(choice, 10);
      if (!isNaN(num) && num >= 1 && num <= questions.length) {
        await this.runQuestion(questions[num - 1]);
      }
    }
  }

  // Run a single question
  private async runQuestion(question: BattleQuestion): Promise<void> {
    this.clearScreen();
    this.displayHeader();

    // Find the agent
    const agent = this.agents.get(question.featureAcronym) || this.agents.get('ANR');
    if (!agent) {
      console.log(`${colors.red}No agent found for ${question.featureAcronym}${colors.reset}`);
      await this.prompt('Press Enter to continue...');
      return;
    }

    // Display question
    console.log(`${colors.bold}Question ${question.id}${colors.reset}`);
    console.log(`${colors.dim}Feature: ${question.featureName} (${question.featureFAJ})${colors.reset}`);
    console.log(`${colors.dim}Category: ${question.categoryName} | Points: ${question.points}${colors.reset}`);
    console.log('');
    console.log(`${colors.cyan}${question.content}${colors.reset}`);
    console.log('');
    console.log(`${colors.yellow}Running against ${question.featureAcronym} Agent...${colors.reset}`);
    console.log('');

    // Execute question against agent
    const startTime = Date.now();
    let response: AgentResponse;

    try {
      const agentResponse = await agent.handleQueryEnhanced({
        id: question.id,
        type: question.type as any,
        content: question.content,
        complexity: question.complexity as any,
        timestamp: new Date(),
      });

      const latency = Date.now() - startTime;

      response = {
        success: true,
        response: agentResponse.response || 'No response generated',
        confidence: agentResponse.confidence || 0.8,
        action: agentResponse.action || 'RESPOND',
        latency,
        state: agentResponse.state || 'OPERATIONAL',
        qValue: agentResponse.qValue,
      };
    } catch (error) {
      response = {
        success: false,
        response: 'Agent failed to process query',
        confidence: 0,
        action: 'ERROR',
        latency: Date.now() - startTime,
        state: 'ERROR',
      };
    }

    // Display response
    this.displayResponse(question, response);

    // Calculate score
    const score = response.success ? Math.round(question.points * response.confidence) : 0;

    // Update session
    this.session.questionsAnswered++;
    this.session.totalScore += score;
    this.session.maxPossibleScore += question.points;
    this.session.responseTimes.push(response.latency);

    // Update category scores
    if (!this.session.categoryScores[question.category]) {
      this.session.categoryScores[question.category] = { earned: 0, max: 0 };
    }
    this.session.categoryScores[question.category].earned += score;
    this.session.categoryScores[question.category].max += question.points;

    // Update feature scores
    if (!this.session.featureScores[question.featureAcronym]) {
      this.session.featureScores[question.featureAcronym] = { earned: 0, max: 0, questions: 0 };
    }
    this.session.featureScores[question.featureAcronym].earned += score;
    this.session.featureScores[question.featureAcronym].max += question.points;
    this.session.featureScores[question.featureAcronym].questions++;

    // Show score
    console.log('');
    const pct = Math.round((this.session.totalScore / this.session.maxPossibleScore) * 100);
    console.log(`${colors.bold}Score: ${score}/${question.points}${colors.reset} | Session: ${this.session.totalScore}/${this.session.maxPossibleScore} (${pct}%)`);
    console.log('');

    await this.prompt('Press Enter to continue...');
  }

  // Display agent response
  private displayResponse(question: BattleQuestion, response: AgentResponse): void {
    const width = 76;
    const hr = '─'.repeat(width);

    console.log(`${colors.cyan}┌─ Agent Response ${'─'.repeat(width - 18)}┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} Feature: ${question.featureName.substring(0, 50).padEnd(50)} (${question.featureFAJ.padEnd(12)}) ${colors.cyan}│${colors.reset}`);

    const stateColor = response.state === 'OPERATIONAL' ? colors.green :
                       response.state === 'ERROR' ? colors.red : colors.yellow;
    const healthPct = Math.round(response.confidence * 100);
    console.log(`${colors.cyan}│${colors.reset} State: ${stateColor}${response.state.padEnd(12)}${colors.reset} | Health: ${healthPct}% | Latency: ${response.latency}ms`.padEnd(width + 10) + `${colors.cyan}│${colors.reset}`);

    console.log(`${colors.cyan}├${hr}┤${colors.reset}`);

    // Wrap response text
    const lines = this.wrapText(response.response, width - 4);
    for (const line of lines.slice(0, 8)) {
      console.log(`${colors.cyan}│${colors.reset} ${line.padEnd(width - 2)} ${colors.cyan}│${colors.reset}`);
    }
    if (lines.length > 8) {
      console.log(`${colors.cyan}│${colors.reset} ${colors.dim}... (${lines.length - 8} more lines)${colors.reset}`.padEnd(width + 12) + `${colors.cyan}│${colors.reset}`);
    }

    console.log(`${colors.cyan}├${hr}┤${colors.reset}`);

    const confPct = Math.round(response.confidence * 100);
    const qVal = response.qValue ? response.qValue.toFixed(2) : 'N/A';
    console.log(`${colors.cyan}│${colors.reset} Confidence: ${confPct}% | Action: ${response.action} | Q-Value: ${qVal}`.padEnd(width + 10) + `${colors.cyan}│${colors.reset}`);

    console.log(`${colors.cyan}└${'─'.repeat(width)}┘${colors.reset}`);
  }

  // Wrap text to width
  private wrapText(text: string, width: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }

  // Random challenge
  private async randomChallenge(): Promise<void> {
    this.clearScreen();
    this.displayHeader();

    console.log(`${colors.bold}Random Challenge${colors.reset}`);
    console.log('');
    console.log('How many random questions?');
    console.log(`  ${colors.dim}(1-${this.allQuestions.length}, default: 5)${colors.reset}`);
    console.log('');

    const input = await this.prompt(`${colors.yellow}> ${colors.reset}`);
    const count = Math.min(Math.max(parseInt(input, 10) || 5, 1), this.allQuestions.length);

    // Shuffle and pick
    const shuffled = [...this.allQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    console.log('');
    console.log(`Starting ${count} random questions...`);
    console.log('');

    for (let i = 0; i < selected.length; i++) {
      console.log(`${colors.yellow}Question ${i + 1} of ${count}${colors.reset}`);
      await this.runQuestion(selected[i]);
    }

    console.log(`${colors.green}Random challenge complete!${colors.reset}`);
    await this.prompt('Press Enter to continue...');
  }

  // Search questions
  private async searchQuestions(): Promise<void> {
    this.clearScreen();
    this.displayHeader();

    console.log(`${colors.bold}Search Questions${colors.reset}`);
    console.log('');
    console.log('Enter search term (feature, keyword, etc.):');
    console.log('');

    const query = (await this.prompt(`${colors.yellow}> ${colors.reset}`)).toLowerCase();
    if (!query) return;

    const results = this.allQuestions.filter(q =>
      q.content.toLowerCase().includes(query) ||
      q.featureAcronym.toLowerCase().includes(query) ||
      q.featureName.toLowerCase().includes(query)
    );

    if (results.length === 0) {
      console.log(`${colors.yellow}No questions found matching "${query}"${colors.reset}`);
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log(`${colors.green}Found ${results.length} questions${colors.reset}`);
    await this.browseQuestions(results, `Search: "${query}"`);
  }

  // Show session statistics
  private showStatistics(): void {
    this.clearScreen();
    this.displayHeader();

    const duration = Math.round((Date.now() - this.session.startTime) / 1000);
    const avgLatency = this.session.responseTimes.length > 0
      ? Math.round(this.session.responseTimes.reduce((a, b) => a + b, 0) / this.session.responseTimes.length)
      : 0;

    console.log(`${colors.bold}Session Statistics${colors.reset}`);
    console.log('');
    console.log(`  Questions Answered: ${this.session.questionsAnswered}`);
    console.log(`  Total Score: ${this.session.totalScore}/${this.session.maxPossibleScore} (${this.session.maxPossibleScore > 0 ? Math.round((this.session.totalScore / this.session.maxPossibleScore) * 100) : 0}%)`);
    console.log(`  Session Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
    console.log(`  Avg Response Time: ${avgLatency}ms`);
    console.log('');

    console.log(`${colors.bold}Category Breakdown:${colors.reset}`);
    for (const [cat, scores] of Object.entries(this.session.categoryScores)) {
      if (scores.max > 0) {
        const pct = Math.round((scores.earned / scores.max) * 100);
        const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
        const catName = cat === 'A' ? 'Knowledge' : cat === 'B' ? 'Decision' : 'Advanced';
        console.log(`  ${catName.padEnd(12)} [${bar}] ${pct}% (${scores.earned}/${scores.max})`);
      }
    }
    console.log('');

    // Top features
    const featureEntries = Object.entries(this.session.featureScores)
      .filter(([, s]) => s.max > 0)
      .sort((a, b) => (b[1].earned / b[1].max) - (a[1].earned / a[1].max))
      .slice(0, 10);

    if (featureEntries.length > 0) {
      console.log(`${colors.bold}Top Features:${colors.reset}`);
      for (const [acronym, scores] of featureEntries) {
        const pct = Math.round((scores.earned / scores.max) * 100);
        console.log(`  ${acronym.padEnd(10)} ${pct}% (${scores.earned}/${scores.max}) - ${scores.questions} questions`);
      }
    }
    console.log('');
  }

  // Full battle test
  private async fullBattleTest(): Promise<void> {
    this.clearScreen();
    this.displayHeader();

    console.log(`${colors.bold}Full Battle Test${colors.reset}`);
    console.log('');
    console.log(`This will run all ${this.allQuestions.length} questions sequentially.`);
    console.log(`${colors.yellow}Warning: This may take a while!${colors.reset}`);
    console.log('');
    console.log('Continue? [Y/N]');
    console.log('');

    const confirm = (await this.prompt(`${colors.yellow}> ${colors.reset}`)).toUpperCase();
    if (confirm !== 'Y') return;

    console.log('');
    console.log('Starting full battle test...');
    console.log('');

    for (let i = 0; i < this.allQuestions.length; i++) {
      console.log(`\n${colors.cyan}═══ Question ${i + 1} of ${this.allQuestions.length} ═══${colors.reset}\n`);
      await this.runQuestion(this.allQuestions[i]);
    }

    this.showStatistics();
    await this.prompt('Press Enter to continue...');
  }

  // Main loop
  async run(): Promise<void> {
    await this.initialize();

    while (true) {
      this.clearScreen();
      this.displayHeader();

      const choice = await this.showMainMenu();

      switch (choice) {
        case '1':
          await this.browseByCategory();
          break;
        case '2':
          await this.browseByFeature();
          break;
        case '3':
          await this.randomChallenge();
          break;
        case '4':
          await this.fullBattleTest();
          break;
        case '5':
          await this.searchQuestions();
          break;
        case 's':
          this.showStatistics();
          await this.prompt('Press Enter to continue...');
          break;
        case 'q':
        case 'quit':
        case 'exit':
          this.clearScreen();
          this.displayHeader();
          this.showStatistics();
          console.log(`${colors.green}Thanks for playing the RAN Agent Battle Arena!${colors.reset}`);
          console.log('');
          this.rl.close();
          return;
        default:
          // Invalid choice, show menu again
          break;
      }
    }
  }
}

// Main
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
RAN Agent Battle Arena - Interactive CLI Demo

Usage:
  bun run scripts/battle-test/ran-battle-cli.ts [options]

Options:
  --help, -h    Show this help message

Modes (interactive selection):
  1. Browse by Category  - Filter questions by Knowledge/Decision/Advanced
  2. Browse by Feature   - Filter questions by LTE feature (50 features)
  3. Random Challenge    - Answer random questions
  4. Full Battle Test    - Run all 300 questions
  5. Search Questions    - Search by keyword

Examples:
  bun run scripts/battle-test/ran-battle-cli.ts
`);
    process.exit(0);
  }

  const cli = new RANBattleCLI();
  await cli.run();
}

main().catch(console.error);
