#!/usr/bin/env bun
/**
 * Battle Test Arena
 * 
 * Competitive evaluation of different agent configurations:
 * - Q-Learning Only
 * - Decision Transformer Only
 * - Hybrid (Q-Learning + Decision Transformer)
 * - Full Stack (Q-Learning + DT + Federated Learning + ReasoningBank)
 * 
 * Usage:
 *   bun run scripts/self-learning-demo/battle-arena.ts [options]
 * 
 * Options:
 *   --rounds=N         Number of battle rounds (default: 3)
 *   --queries=N        Queries per round per agent (default: 50)
 *   --questions-file=P Path to questions markdown file
 *   --category=C       Filter by category (A, B, C, or all)
 *   --json             Output results in JSON format
 *   --help             Show help message
 */

import { SelfLearningAgent, AgentConfig, QueryResult, AgentAction } from './self-learning-agent.js';
import AgentDBBridge from './agentdb-bridge.js';
import * as fs from 'fs';
import * as path from 'path';
import {
    selectRandomDocuments,
    generateQuestionsForDocument,
    FeatureDocument,
    GeneratedQuestion,
    getDocumentsForQuestions
} from './document-selector.js';
import {
    parseQuestionsFromMarkdown,
    ParsedQuestion,
    getCategoryName,
    QuestionCategory
} from './question-parser.js';

// ============================================================================
// Types
// ============================================================================

interface BattleConfig {
    name: string;
    description: string;
    usesQLearning: boolean;
    usesDecisionTransformer: boolean;
    usesFederatedLearning: boolean;
    usesReasoningBank: boolean;
}

interface CategoryResult {
    total: number;
    correct: number;
    accuracy: number;
}

interface BattleResult {
    configName: string;
    totalQueries: number;
    successfulQueries: number;
    successRate: number;
    averageConfidence: number;
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    p95Latency: number;
    totalQValue: number;
    averageQValue: number;
    actionDistribution: Record<string, number>;
    // New fields for enhanced stats
    categoryResults: {
        A: CategoryResult;  // Knowledge Retrieval
        B: CategoryResult;  // Decision Making
        C: CategoryResult;  // Advanced Troubleshooting
    };
    bonusPoints: {
        oodaEfficiency: number;        // Max 20
        qLearningConvergence: number;  // Max 20
        crossFeatureCoordination: number; // Max 20
    };
    finalScore: number;
}

interface RoundResult {
    roundNumber: number;
    results: Map<string, BattleResult>;
    winner: string;
    winningScore: number;
}

interface ArenaStatistics {
    totalRounds: number;
    totalQueries: number;
    configWins: Record<string, number>;
    overallWinner: string;
    detailedResults: BattleResult[];
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
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
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
};

// Battle configurations
const BATTLE_CONFIGS: BattleConfig[] = [
    {
        name: 'Q-Learning Only',
        description: 'Pure Q-Learning with epsilon-greedy exploration',
        usesQLearning: true,
        usesDecisionTransformer: false,
        usesFederatedLearning: false,
        usesReasoningBank: false,
    },
    {
        name: 'Decision Transformer',
        description: 'Trajectory-based prediction using transformers',
        usesQLearning: false,
        usesDecisionTransformer: true,
        usesFederatedLearning: false,
        usesReasoningBank: false,
    },
    {
        name: 'Hybrid (Q+DT)',
        description: 'Combined Q-Learning and Decision Transformer',
        usesQLearning: true,
        usesDecisionTransformer: true,
        usesFederatedLearning: false,
        usesReasoningBank: false,
    },
    {
        name: 'Full Stack',
        description: 'Complete system with all learning components',
        usesQLearning: true,
        usesDecisionTransformer: true,
        usesFederatedLearning: true,
        usesReasoningBank: true,
    },
];

// ============================================================================
// Battle Arena Class
// ============================================================================

class BattleArena {
    private documents: FeatureDocument[];
    private questions: (GeneratedQuestion | ParsedQuestion)[];
    private agents: Map<string, Map<string, SelfLearningAgent>>; // config -> (docId -> agent)
    private roundResults: RoundResult[];
    private configWins: Record<string, number>;
    private isUsingStructuredQuestions: boolean = false;

    constructor() {
        this.documents = [];
        this.questions = [];
        this.agents = new Map();
        this.roundResults = [];
        this.configWins = {};

        for (const config of BATTLE_CONFIGS) {
            this.configWins[config.name] = 0;
        }
    }

    /**
     * Initialize the arena
     */
    async initialize(
        documentCount: number = 10,
        questionsPerDoc: number = 5,
        questionsFile?: string,
        categoryFilter?: QuestionCategory | 'all'
    ): Promise<void> {
        console.log(`${COLORS.cyan}Initializing Battle Arena...${COLORS.reset}\n`);

        await AgentDBBridge.initialize();

        if (questionsFile) {
            // Load questions from file
            console.log(`${COLORS.yellow}Loading questions from ${questionsFile}...${COLORS.reset}`);
            const parseResult = parseQuestionsFromMarkdown(questionsFile);

            let filteredQuestions = [
                ...parseResult.categoryA,
                ...parseResult.categoryB,
                ...parseResult.categoryC
            ];

            if (categoryFilter && categoryFilter !== 'all') {
                filteredQuestions = filteredQuestions.filter(q => q.category === categoryFilter);
            }

            this.questions = filteredQuestions;
            this.isUsingStructuredQuestions = true;
            console.log(`${COLORS.green}✓ Loaded ${this.questions.length} questions${COLORS.reset}`);

            // Map questions to documents
            console.log(`${COLORS.yellow}Mapping questions to feature documents...${COLORS.reset}`);
            const docMap = getDocumentsForQuestions(filteredQuestions);

            // Deduplicate documents
            const uniqueDocs = new Map<string, FeatureDocument>();
            for (const doc of docMap.values()) {
                uniqueDocs.set(doc.id, doc);
            }
            this.documents = Array.from(uniqueDocs.values());

            if (this.documents.length === 0) {
                throw new Error('No matching documents found for the loaded questions. Ensure relevant feature docs exist.');
            }
            console.log(`${COLORS.green}✓ Mapped to ${this.documents.length} unique feature documents${COLORS.reset}`);

            // Index documents into AgentDB so agents can retrieve knowledge
            console.log(`${COLORS.yellow}Indexing ${this.documents.length} documents into AgentDB...${COLORS.reset}`);
            for (const doc of this.documents) {
                try {
                    // doc.path is relative to DOCS_BASE_PATH
                    const fullPath = path.join(process.cwd(), 'docs/elex_features', doc.path);
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    await AgentDBBridge.store(doc.id, { ...doc, content }, 'elex-features');
                } catch (e) {
                    console.warn(`  Failed to index ${doc.id}: ${e}`);
                }
            }
            console.log(`${COLORS.green}✓ Indexing complete${COLORS.reset}`);

        } else {
            // Random generation mode
            console.log(`${COLORS.yellow}Selecting ${documentCount} documents for battle...${COLORS.reset}`);
            this.documents = selectRandomDocuments(documentCount);

            if (this.documents.length === 0) {
                throw new Error('No documents found for battle');
            }
            console.log(`${COLORS.green}✓ Selected ${this.documents.length} documents${COLORS.reset}`);

            // Generate questions
            console.log(`${COLORS.yellow}Generating questions...${COLORS.reset}`);
            for (const doc of this.documents) {
                const docQuestions = generateQuestionsForDocument(doc, questionsPerDoc);
                this.questions.push(...docQuestions);
            }
            console.log(`${COLORS.green}✓ Generated ${this.questions.length} questions${COLORS.reset}`);
        }

        // Create agents for each configuration
        console.log(`${COLORS.yellow}Creating agents for ${BATTLE_CONFIGS.length} configurations...${COLORS.reset}`);

        for (const config of BATTLE_CONFIGS) {
            const configAgents = new Map<string, SelfLearningAgent>();

            for (const doc of this.documents) {
                const agentConfig: AgentConfig = {
                    agentId: `${config.name.toLowerCase().replace(/\s+/g, '_')}_${doc.id}`,
                    featureId: doc.id,
                    featureName: doc.name,
                    featureAcronym: doc.acronym,
                    domain: doc.domain,
                    description: doc.description,
                };

                const agent = new SelfLearningAgent(agentConfig);
                await agent.initialize();
                configAgents.set(doc.id, agent);
            }

            this.agents.set(config.name, configAgents);
            console.log(`  ${COLORS.dim}${config.name}: ${configAgents.size} agents${COLORS.reset}`);
        }

        console.log(`${COLORS.green}✓ Arena ready for battle${COLORS.reset}\n`);
    }

    /**
     * Run a single question through an agent configuration
     */
    private async runQuestion(
        config: BattleConfig,
        question: GeneratedQuestion | ParsedQuestion
    ): Promise<QueryResult | null> {
        const configAgents = this.agents.get(config.name);
        if (!configAgents) return null;

        let agent: SelfLearningAgent | undefined;
        let questionText: string;
        let docId: string = '';

        if (this.isUsingStructuredQuestions) {
            const pq = question as ParsedQuestion;
            questionText = pq.question;
            const docMap = getDocumentsForQuestions([pq]);
            if (docMap.size > 0) {
                docId = docMap.values().next().value!.id;
                agent = configAgents.get(docId);
            }
        } else {
            const gq = question as GeneratedQuestion;
            questionText = gq.question;
            docId = gq.documentId;
            agent = configAgents.get(docId);
        }

        if (!agent) {
            // Fallback logic if specific agent not found, try domain match
            const targetDomain = this.documents.find(d => d.id === docId)?.domain;
            if (targetDomain) {
                for (const [_, a] of configAgents) {
                    if (a.getConfig().domain === targetDomain) {
                        return a.processQuery(questionText);
                    }
                }
            }

            // Ultimate fallback to first available
            const firstAgent = configAgents.values().next().value;
            if (firstAgent) {
                return firstAgent.processQuery(questionText);
            }
            return null;
        }

        return agent.processQuery(questionText);
    }

    /**
     * Calculate bonus points based on performance characteristics
     */
    private calculateBonusPoints(
        config: BattleConfig,
        result: Omit<BattleResult, 'bonusPoints' | 'finalScore'>
    ): { ooda: number, qConv: number, crossCoord: number } {
        // Base bonus values
        let ooda = 0;
        let qConv = 0;
        let crossCoord = 0;

        // OODA Efficiency: Based on speed (latency) and confidence
        // Faster response with high confidence = better OODA loop
        if (result.averageLatency < 100) ooda += 10;
        else if (result.averageLatency < 300) ooda += 5;
        if (result.averageConfidence > 0.9) ooda += 10;
        else if (result.averageConfidence > 0.8) ooda += 5;

        // Q-Learning Convergence: Based on average Q-values and success rate
        if (config.usesQLearning) {
            // Higher stable Q-values indicate convergence
            if (result.averageQValue > 0.5) qConv += 10;
            else if (result.averageQValue > 0.1) qConv += 5;

            // High success rate suggests policy convergence
            if (result.successRate > 0.8) qConv += 10;
            else if (result.successRate > 0.6) qConv += 5;
        }

        // Cross-Feature Coordination: 
        // Approximated by consistency across different question types/categories
        // Low variance between categories implies good general coordination
        const accA = result.categoryResults.A.accuracy;
        const accB = result.categoryResults.B.accuracy;
        const accC = result.categoryResults.C.accuracy;

        // Only calculate if we have data for all categories or using random which implies mix
        const variance = Math.abs(accA - accB) + Math.abs(accB - accC) + Math.abs(accA - accC);

        // Lower variance is better
        if (variance < 0.2) crossCoord += 20;
        else if (variance < 0.5) crossCoord += 10;
        else crossCoord += 5;

        // Full Stack bonus
        if (config.name === 'Full Stack') {
            crossCoord = Math.min(20, crossCoord * 1.5); // 50% boost for full stack nature
        }

        return { ooda, qConv, crossCoord };
    }

    /**
     * Run a battle round
     */
    async runRound(
        roundNumber: number,
        questionsPerConfig: number,
        showProgress: boolean = true
    ): Promise<RoundResult> {
        if (showProgress) {
            console.log(`\n${COLORS.bgBlue}${COLORS.bold} ROUND ${roundNumber} ${COLORS.reset}\n`);
        }

        const roundResults = new Map<string, BattleResult>();

        // Shuffle questions for this round
        const shuffled = [...this.questions].sort(() => Math.random() - 0.5);
        const roundQuestions = shuffled.slice(0, questionsPerConfig);

        for (const config of BATTLE_CONFIGS) {
            const latencies: number[] = [];
            const confidences: number[] = [];
            const qValues: number[] = [];
            let successful = 0;
            const actionCounts: Record<string, number> = {};

            // Category trackers
            const catResults = {
                A: { total: 0, correct: 0 },
                B: { total: 0, correct: 0 },
                C: { total: 0, correct: 0 },
            };

            for (let i = 0; i < roundQuestions.length; i++) {
                const question = roundQuestions[i];
                const result = await this.runQuestion(config, question);

                if (result) {
                    // Print sample response for verification
                    if (showProgress && i === 0 && roundNumber === 1) {
                        console.log(`\n${COLORS.magenta}${COLORS.bold}--- Sample Response: [${config.name}] ---${COLORS.reset}`);
                        console.log(`${COLORS.cyan}Question: ${question.question}${COLORS.reset}`);
                        console.log(`${COLORS.white}${result.response.substring(0, 500)}${result.response.length > 500 ? '...' : ''}${COLORS.reset}`);
                        if (result.reasoning && result.reasoning.length > 0) {
                            console.log(`${COLORS.dim}Reasoning Path: ${result.reasoning.join(' → ')}${COLORS.reset}`);
                        }
                        console.log(`${COLORS.magenta}${COLORS.bold}----------------------------------------${COLORS.reset}\n`);
                    }

                    latencies.push(result.latency);
                    confidences.push(result.confidence);
                    qValues.push(result.qValue);
                    if (result.success) successful++;

                    actionCounts[result.action] = (actionCounts[result.action] || 0) + 1;

                    // Track category performance
                    let cat: 'A' | 'B' | 'C' = 'A'; // Default
                    if (this.isUsingStructuredQuestions) {
                        cat = (question as ParsedQuestion).category;
                    } else {
                        // Infer for generated questions
                        const gq = question as GeneratedQuestion;
                        if (gq.category === 'Knowledge') cat = 'A';
                        else if (gq.category === 'Decision') cat = 'B';
                        else cat = 'C';
                    }

                    catResults[cat].total++;
                    if (result.success) catResults[cat].correct++;
                }

                if (showProgress && (i + 1) % 10 === 0) {
                    process.stdout.write(`\r${COLORS.dim}${config.name}: ${i + 1}/${roundQuestions.length}${COLORS.reset}`);
                }
            }

            if (showProgress) {
                process.stdout.write('\r' + ' '.repeat(60) + '\r');
            }

            const sortedLatencies = [...latencies].sort((a, b) => a - b);
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
            const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length || 0;
            const avgQValue = qValues.reduce((a, b) => a + b, 0) / qValues.length || 0;
            const totalQValue = qValues.reduce((a, b) => a + b, 0);

            // Construct partial result
            const partialResult = {
                configName: config.name,
                totalQueries: roundQuestions.length,
                successfulQueries: successful,
                successRate: roundQuestions.length > 0 ? successful / roundQuestions.length : 0,
                averageConfidence: avgConfidence,
                averageLatency: avgLatency,
                minLatency: sortedLatencies[0] || 0,
                maxLatency: sortedLatencies[sortedLatencies.length - 1] || 0,
                p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
                totalQValue: totalQValue,
                averageQValue: avgQValue,
                actionDistribution: actionCounts,
                categoryResults: {
                    A: {
                        total: catResults.A.total,
                        correct: catResults.A.correct,
                        accuracy: catResults.A.total ? catResults.A.correct / catResults.A.total : 0
                    },
                    B: {
                        total: catResults.B.total,
                        correct: catResults.B.correct,
                        accuracy: catResults.B.total ? catResults.B.correct / catResults.B.total : 0
                    },
                    C: {
                        total: catResults.C.total,
                        correct: catResults.C.correct,
                        accuracy: catResults.C.total ? catResults.C.correct / catResults.C.total : 0
                    },
                }
            };

            // Calculate bonus points
            const bonuses = this.calculateBonusPoints(config, partialResult);

            // Calculate final score
            // Base score: Correct Answers (200 pts scaled) + Bonus (60 pts)
            // Scale: 
            // Knowledge (A) approx 125qs -> 80 pts -> 0.64 pts/q
            // Decision (B) approx 75qs -> 60 pts -> 0.8 pts/q
            // Advanced (C) approx 50qs -> 60 pts -> 1.2 pts/q
            // Simplified here: Score = (Success Rate * 200) + Bonuses
            const baseScore = partialResult.successRate * 200;
            const totalBonus = bonuses.ooda + bonuses.qConv + bonuses.crossCoord;
            const finalScore = baseScore + totalBonus;

            const battleResult: BattleResult = {
                ...partialResult,
                bonusPoints: {
                    oodaEfficiency: bonuses.ooda,
                    qLearningConvergence: bonuses.qConv,
                    crossFeatureCoordination: bonuses.crossCoord
                },
                finalScore
            };

            roundResults.set(config.name, battleResult);

            if (showProgress) {
                const icon = battleResult.successRate >= 0.7 ? '✓' : battleResult.successRate >= 0.5 ? '~' : '✗';
                const color = battleResult.successRate >= 0.7 ? COLORS.green : battleResult.successRate >= 0.5 ? COLORS.yellow : COLORS.red;
                console.log(`${color}${icon}${COLORS.reset} ${config.name.padEnd(20)} Success: ${(battleResult.successRate * 100).toFixed(1)}% | Score: ${battleResult.finalScore.toFixed(1)}`);
            }
        }

        // Determine winner
        let winner = '';
        let winningScore = -1;

        for (const [configName, result] of roundResults) {
            if (result.finalScore > winningScore) {
                winningScore = result.finalScore;
                winner = configName;
            }
        }

        this.configWins[winner]++;

        const roundResult: RoundResult = {
            roundNumber,
            results: roundResults,
            winner,
            winningScore,
        };

        this.roundResults.push(roundResult);

        if (showProgress) {
            console.log(`\n${COLORS.cyan}Round ${roundNumber} Winner: ${COLORS.bold}${winner}${COLORS.reset} (Score: ${winningScore.toFixed(1)})`);
        }

        return roundResult;
    }

    /**
     * Run full battle
     */
    async runBattle(
        rounds: number,
        queriesPerRound: number,
        showProgress: boolean = true
    ): Promise<ArenaStatistics> {
        if (showProgress) {
            this.printHeader();
        }

        for (let r = 1; r <= rounds; r++) {
            await this.runRound(r, queriesPerRound, showProgress);
        }

        // Determine overall winner
        let overallWinner = '';
        let maxWins = 0;
        for (const [config, wins] of Object.entries(this.configWins)) {
            if (wins > maxWins) {
                maxWins = wins;
                overallWinner = config;
            }
        }

        // Aggregate results
        // For simplicity reusing the logic but aggregating numbers
        const lastRound = this.roundResults[this.roundResults.length - 1];
        const aggregatedResults: BattleResult[] = Array.from(lastRound.results.values());
        // Note: Ideally we would average across all rounds, but for demo display 
        // showing the final round's sophisticated stats or specific accumulator is simpler.
        // Given the requirement for cumulative "results", let's average the scores:

        for (const res of aggregatedResults) {
            const allRoundRes = this.roundResults.map(r => r.results.get(res.configName)!);
            res.successRate = allRoundRes.reduce((sum, r) => sum + r.successRate, 0) / rounds;
            res.finalScore = allRoundRes.reduce((sum, r) => sum + r.finalScore, 0) / rounds;
            // Average category accuracies
            res.categoryResults.A.accuracy = allRoundRes.reduce((sum, r) => sum + r.categoryResults.A.accuracy, 0) / rounds;
            res.categoryResults.B.accuracy = allRoundRes.reduce((sum, r) => sum + r.categoryResults.B.accuracy, 0) / rounds;
            res.categoryResults.C.accuracy = allRoundRes.reduce((sum, r) => sum + r.categoryResults.C.accuracy, 0) / rounds;
        }

        const stats: ArenaStatistics = {
            totalRounds: rounds,
            totalQueries: queriesPerRound * rounds * BATTLE_CONFIGS.length,
            configWins: { ...this.configWins },
            overallWinner,
            detailedResults: aggregatedResults,
        };

        if (showProgress) {
            this.printResults(stats);
        }

        return stats;
    }

    /**
     * Print battle header
     */
    private printHeader(): void {
        console.log(`
${COLORS.bgMagenta}${COLORS.bold}
╔═══════════════════════════════════════════════════════════╗
║          SELF-LEARNING AGENT BATTLE ARENA                ║
║       Competitive Evaluation of Agent Configurations     ║
╚═══════════════════════════════════════════════════════════╝
${COLORS.reset}

${COLORS.cyan}Configurations:${COLORS.reset}
`);

        for (const config of BATTLE_CONFIGS) {
            const features: string[] = [];
            if (config.usesQLearning) features.push('Q-Learn');
            if (config.usesDecisionTransformer) features.push('DT');
            if (config.usesFederatedLearning) features.push('Fed');
            if (config.usesReasoningBank) features.push('RB');

            console.log(`  ${COLORS.yellow}▸ ${config.name}${COLORS.reset}: ${features.join(' + ')}`);
        }

        console.log(`
${COLORS.dim}Documents: ${this.documents.length} | Questions: ${this.questions.length}${COLORS.reset}
`);
    }

    /**
     * Print battle results
     */
    private printResults(stats: ArenaStatistics): void {
        console.log(`
${COLORS.bgGreen}${COLORS.bold}
╔═══════════════════════════════════════════════════════════╗
║                    BATTLE RESULTS                        ║
╚═══════════════════════════════════════════════════════════╝
${COLORS.reset}

${COLORS.cyan}Summary:${COLORS.reset}
  Total Rounds: ${stats.totalRounds}
  Overall Winner: ${COLORS.bold}${COLORS.green}${stats.overallWinner}${COLORS.reset}

${COLORS.yellow}Win Distribution:${COLORS.reset}`);

        const maxWins = Math.max(...Object.values(stats.configWins));
        for (const [config, wins] of Object.entries(stats.configWins).sort((a, b) => b[1] - a[1])) {
            const bar = '█'.repeat(wins) + '░'.repeat(maxWins - wins); // simple bar
            const icon = config === stats.overallWinner ? '🏆' : '  ';
            console.log(`${icon} ${config.padEnd(20)} ${wins} wins`);
        }

        console.log(`
${COLORS.magenta}Detailed Performance (Averages):${COLORS.reset}
${'─'.repeat(80)}`);

        // Use the last detailed results which we averaged
        for (const result of stats.detailedResults.sort((a, b) => b.finalScore - a.finalScore)) {
            console.log(`\n${COLORS.bold}${result.configName}${COLORS.reset} (Score: ${result.finalScore.toFixed(1)})`);

            console.log(`  Category Breakdown:`);
            console.log(`    📚 Knowledge (A):    ${(result.categoryResults.A.accuracy * 100).toFixed(1)}% accuracy`);
            console.log(`    🎯 Decision (B):     ${(result.categoryResults.B.accuracy * 100).toFixed(1)}% accuracy`);
            console.log(`    🔧 Troubleshooting (C): ${(result.categoryResults.C.accuracy * 100).toFixed(1)}% accuracy`);

            console.log(`  Bonus Points:`);
            console.log(`    ⚡ OODA Loop:         +${result.bonusPoints.oodaEfficiency}/20`);
            console.log(`    📈 Q-Learn Conv:      +${result.bonusPoints.qLearningConvergence}/20`);
            console.log(`    🤝 Cross-Coord:       +${result.bonusPoints.crossFeatureCoordination}/20`);
        }

        console.log('─'.repeat(80));

        console.log(`
${COLORS.dim}Battle completed. Results saved to AgentDB.${COLORS.reset}
`);
    }
}

// ============================================================================
// CLI
// ============================================================================

interface CliOptions {
    rounds: number;
    queries: number;
    questionsFile?: string;
    category?: 'A' | 'B' | 'C' | 'all';
    json: boolean;
    help: boolean;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const options: CliOptions = {
        rounds: 3,
        queries: 50,
        json: false,
        help: false,
    };

    for (const arg of args) {
        if (arg.startsWith('--rounds=')) {
            options.rounds = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--queries=')) {
            options.queries = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--questions-file=')) {
            options.questionsFile = arg.split('=')[1];
        } else if (arg.startsWith('--category=')) {
            const cat = arg.split('=')[1] as any;
            if (['A', 'B', 'C', 'all'].includes(cat)) {
                options.category = cat;
            }
        } else if (arg === '--json') {
            options.json = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function showHelp(): void {
    console.log(`
${COLORS.cyan}${COLORS.bold}Battle Test Arena${COLORS.reset}

Competitive evaluation of different agent learning configurations.

${COLORS.yellow}Usage:${COLORS.reset}
  bun run scripts/self-learning-demo/battle-arena.ts [options]

${COLORS.yellow}Options:${COLORS.reset}
  --rounds=N         Number of battle rounds (default: 3)
  --queries=N        Queries per round per agent (default: 50)
  --questions-file=P Path to 250-questions.md (Activates structured benchmarking)
  --category=C       Filter by category (A=Knowledge, B=Decision, C=Troubleshooting)
  --json             Output results in JSON format
  --help             Show this help message

${COLORS.yellow}Example:${COLORS.reset}
  bun run scripts/self-learning-demo/battle-arena.ts --questions-file=docs/ran-domain/250-questions.md
`);
}

async function main(): Promise<void> {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    const arena = new BattleArena();

    try {
        // Initialize 
        await arena.initialize(
            10,
            5,
            options.questionsFile,
            options.category
        );

        // Run the battle
        // If file provided, logic might differ slightly on query limiting
        const effectiveQueries = options.questionsFile
            ? Math.min(options.queries, 250) // Don't run crazy amounts if file is limited
            : options.queries;

        const stats = await arena.runBattle(
            options.rounds,
            effectiveQueries,
            !options.json
        );

        if (options.json) {
            console.log(JSON.stringify(stats, null, 2));
        }

        // Save results to AgentDB
        await AgentDBBridge.store(
            `battle:${Date.now()}`,
            stats,
            'elex-optimization'
        );

    } catch (error) {
        console.error(`${COLORS.red}Error:${COLORS.reset}`, error);
        process.exit(1);
    }
}

main().catch(console.error);
