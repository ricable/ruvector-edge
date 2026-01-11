/**
 * Question Bank Loader
 *
 * Loads the 250 RAN Battle Test questions from the markdown document
 * and creates TestQuestion entities for storage in AgentDB.
 *
 * @module ran-battle-test/aggregates/question-bank-loader
 */

import { TestQuestion, QuestionCategory, QuestionType, ComplexityLevel } from '../entities/test-question';
import { LTE_50_FEATURES } from './lte-features-constants';

/**
 * Parsed question from markdown
 */
interface ParsedQuestion {
  questionNumber: number;
  category: QuestionCategory;
  type: QuestionType;
  featureAcronym: string;
  featureFAJ: string;
  featureName: string;
  content: string;
  complexity: ComplexityLevel;
}

/**
 * Question Bank Loader
 */
export class QuestionBankLoader {
  /**
   * Parse the 250 questions markdown document
   */
  static parseQuestionsDocument(markdown: string): TestQuestion[] {
    const questions: TestQuestion[] = [];
    const lines = markdown.split('\n');

    let currentFeatureAcronym = '';
    let currentFeatureFAJ = '';
    let currentFeatureName = '';
    let questionNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Feature header (e.g., "## 1. MSM - MIMO Sleep Mode (FAJ 121 3094)")
      if (line.startsWith('## ') && line.includes('FAJ')) {
        const match = line.match(/## (\d+)\.\s+(\w+)\s+-\s+([^(]+)\s+\(FAJ\s+([^)]+)\)/);
        if (match) {
          questionNumber = parseInt(match[1], 10);
          currentFeatureAcronym = match[2];
          currentFeatureName = match[3].trim();
          currentFeatureFAJ = `FAJ ${match[4]}`;
        }
      }

      // Question header (e.g., "### Q1-MSM-K01")
      else if (line.startsWith('### Q') && line.includes('-')) {
        const qMatch = line.match(/### Q(\d+)-(\w+)-(K\d+|D\d+|A\d+)/);
        if (qMatch) {
          const qNumber = parseInt(qMatch[1], 10);
          const typeStr = qMatch[3];

          // Determine category and type
          let category: QuestionCategory;
          let type: QuestionType;
          let complexity: ComplexityLevel = ComplexityLevel.MODERATE;

          if (typeStr.startsWith('K')) {
            category = QuestionCategory.KNOWLEDGE;
            type = typeStr === 'K01' ? QuestionType.BASIC_KNOWLEDGE :
                   typeStr === 'K02' ? QuestionType.PARAMETER_KNOWLEDGE :
                   QuestionType.COUNTER_KNOWLEDGE;
          } else if (typeStr.startsWith('D')) {
            category = QuestionCategory.DECISION;
            type = QuestionType.DECISION_CRITERIA;
          } else {
            category = QuestionCategory.ADVANCED;
            type = QuestionType.ADVANCED_SCENARIO;
            complexity = ComplexityLevel.EXPERT;
          }

          // Extract question content (next non-empty line)
          let content = '';
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') {
            j++;
          }
          if (j < lines.length) {
            content = lines[j].trim().replace(/^"|"$/g, '');
          }

          // Extract expected elements from content
          const expectedKeywords = this.extractKeywords(content);
          const expectedParameters = this.extractParameters(content);
          const expectedCounters = this.extractCounters(content);

          const question = TestQuestion.create({
            questionNumber: qNumber,
            category,
            type,
            featureAcronym: currentFeatureAcronym,
            featureFAJ: currentFeatureFAJ,
            featureName: currentFeatureName,
            content,
            complexity,
            expectedKeywords,
            expectedParameters,
            expectedCounters,
            points: category === QuestionCategory.KNOWLEDGE ? 5 :
                    category === QuestionCategory.DECISION ? 8 : 10,
            tags: [currentFeatureAcronym, category, type]
          });

          questions.push(question);
        }
      }
    }

    return questions;
  }

  /**
   * Extract keywords from question content
   */
  private static extractKeywords(content: string): string[] {
    const keywords: string[] = [];

    // Technical terms
    const techTerms = [
      'activation', 'deactivation', 'parameter', 'counter', 'KPI',
      'threshold', 'configuration', 'prerequisite', 'dependency',
      'throughput', 'latency', 'SINR', 'CQI', 'RI', 'MIMO',
      'scheduler', 'QCI', 'QoS', 'VoLTE', 'CSFB', 'CA'
    ];

    for (const term of techTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        keywords.push(term);
      }
    }

    return keywords.slice(0, 5); // Max 5 keywords
  }

  /**
   * Extract parameter names from question content
   */
  private static extractParameters(content: string): string[] {
    const params: string[] = [];

    // Common parameter patterns
    const paramPatterns = [
      /sleepMode|sleepStartTime|sleepEndTime/gi,
      /pdcchCfiMode|noOfPucchCqiUsers/gi,
      /lbTpNonQualFraction/gi,
      /mimoMode|txMode/gi,
      /cxc\d+/gi
    ];

    for (const pattern of paramPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        params.push(...matches);
      }
    }

    return [...new Set(params)]; // Deduplicate
  }

  /**
   * Extract counter names from question content
   */
  private static extractCounters(content: string): string[] {
    const counters: string[] = [];

    // Common counter patterns
    const counterPatterns = [
      /pm[A-Z][a-zA-Z]*/g,  // PM counters
      /pmMimoSleep/gi,
      /pmLbEval/gi,
      /pmRach/gi
    ];

    for (const pattern of counterPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        counters.push(...matches);
      }
    }

    return [...new Set(counters)]; // Deduplicate
  }

  /**
   * Create 250 questions from the 50 LTE features
   *
   * Distribution:
   * - Category A (Knowledge): 125 questions = 25 features × 5 questions each
   * - Category B (Decision): 75 questions = 25 features × 3 questions each
   * - Category C (Advanced): 50 questions = 50 features × 1 question each
   *
   * Total: 250 questions (5 per feature in mixed categories)
   */
  static createDefaultQuestions(): TestQuestion[] {
    const questions: TestQuestion[] = [];
    let qNumber = 1;

    // First 25 features get all 5 question types (K01, K02, K03, D01, A01)
    // Next 25 features get 3 question types (K01, D01, A01)
    for (let i = 0; i < LTE_50_FEATURES.length; i++) {
      const feature = LTE_50_FEATURES[i];
      const isFirstHalf = i < 25;

      if (isFirstHalf) {
        // First 25 features: 5 questions each (K01, K02, K03, D01, A01)
        questions.push(
          // K01: Basic knowledge (Category A)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.KNOWLEDGE,
            type: QuestionType.BASIC_KNOWLEDGE,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `What is ${feature.name}? How does it work in LTE networks?`,
            complexity: ComplexityLevel.SIMPLE,
            expectedKeywords: [feature.acronym, 'LTE', 'feature'],
            points: 5
          }),

          // K02: Parameter knowledge (Category A)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.KNOWLEDGE,
            type: QuestionType.PARAMETER_KNOWLEDGE,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `What parameters control ${feature.name}? What are their valid ranges and default values?`,
            complexity: ComplexityLevel.MODERATE,
            expectedKeywords: ['parameter', 'configuration', 'range'],
            expectedParameters: ['featureState'],
            points: 5
          }),

          // K03: Counter/KPI knowledge (Category A)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.KNOWLEDGE,
            type: QuestionType.COUNTER_KNOWLEDGE,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `What performance counters and KPIs monitor ${feature.name}? How is success measured?`,
            complexity: ComplexityLevel.MODERATE,
            expectedKeywords: ['counter', 'KPI', 'performance', 'measurement'],
            expectedCounters: ['pm'],
            points: 5
          }),

          // D01: Decision criteria (Category B)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.DECISION,
            type: QuestionType.DECISION_CRITERIA,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `When should ${feature.name} be activated or configured? What are the decision criteria and prerequisites?`,
            complexity: ComplexityLevel.COMPLEX,
            expectedKeywords: ['activation', 'criteria', 'threshold', 'prerequisite'],
            points: 8
          }),

          // A01: Advanced scenario (Category C)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.ADVANCED,
            type: QuestionType.ADVANCED_SCENARIO,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `${feature.name} is not performing as expected in a production network. What are the troubleshooting steps and which parameters need adjustment?`,
            complexity: ComplexityLevel.EXPERT,
            expectedKeywords: ['troubleshooting', 'parameter', 'adjustment', 'optimization'],
            points: 10
          })
        );
      } else {
        // Next 25 features: 3 questions each (K01, D01, A01)
        questions.push(
          // K01: Basic knowledge (Category A)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.KNOWLEDGE,
            type: QuestionType.BASIC_KNOWLEDGE,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `What is ${feature.name}? What is its purpose in LTE networks?`,
            complexity: ComplexityLevel.SIMPLE,
            expectedKeywords: [feature.acronym, 'LTE'],
            points: 5
          }),

          // D01: Decision criteria (Category B)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.DECISION,
            type: QuestionType.DECISION_CRITERIA,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `Under what conditions should ${feature.name} be used? What factors influence this decision?`,
            complexity: ComplexityLevel.COMPLEX,
            expectedKeywords: ['activation', 'condition', 'criteria', 'factor'],
            points: 8
          }),

          // A01: Advanced scenario (Category C)
          TestQuestion.create({
            questionNumber: qNumber++,
            category: QuestionCategory.ADVANCED,
            type: QuestionType.ADVANCED_SCENARIO,
            featureAcronym: feature.acronym,
            featureFAJ: feature.faj,
            featureName: feature.name,
            content: `A network operator reports issues with ${feature.name}. Analyze the potential root causes and recommend corrective actions.`,
            complexity: ComplexityLevel.EXPERT,
            expectedKeywords: ['troubleshooting', 'root cause', 'corrective', 'action'],
            points: 10
          })
        );
      }
    }

    return questions;
  }
}

export default QuestionBankLoader;
