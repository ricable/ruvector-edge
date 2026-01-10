/**
 * Intent Classifier
 * Classifies query intent and extracts entities
 */

import type {
  QueryType,
  IntentClassification,
  ExtractedEntity,
} from '../types';

/** Intent classification configuration */
export interface IntentClassifierConfig {
  minConfidence: number;
  enableEntityExtraction: boolean;
}

const DEFAULT_CONFIG: IntentClassifierConfig = {
  minConfidence: 0.3,
  enableEntityExtraction: true,
};

/** Keyword patterns for intent classification */
const INTENT_PATTERNS: Record<QueryType, RegExp[]> = {
  parameter: [
    /\bparameter\b/i,
    /\bparam\b/i,
    /\bsetting\b/i,
    /\bconfigure\b/i,
    /\bvalue of\b/i,
    /\bdefault\b/i,
    /\brange\b/i,
    /\bset\s+\w+\s+to\b/i,
    /\bchange\s+\w+\b/i,
  ],
  counter: [
    /\bcounter\b/i,
    /\bmetric\b/i,
    /\bmeasurement\b/i,
    /\bcount\b/i,
    /\bstatistic\b/i,
    /\bpm\s*counter\b/i,
    /\bperf\s*counter\b/i,
  ],
  kpi: [
    /\bkpi\b/i,
    /\bperformance\s*indicator\b/i,
    /\bthroughput\b/i,
    /\blatency\b/i,
    /\bdrop\s*rate\b/i,
    /\bsuccess\s*rate\b/i,
    /\bhandover\s*success\b/i,
    /\bcall\s*setup\b/i,
    /\bbler\b/i,
    /\bsinr\b/i,
    /\brsrp\b/i,
    /\brsrq\b/i,
  ],
  procedure: [
    /\bhow\s+to\b/i,
    /\bsteps\s+to\b/i,
    /\bprocedure\b/i,
    /\bprocess\b/i,
    /\bworkflow\b/i,
    /\bguide\b/i,
    /\binstructions\b/i,
    /\bcan\s+you\s+show\b/i,
    /\bexplain\s+how\b/i,
  ],
  troubleshoot: [
    /\btroubleshoot\b/i,
    /\bproblem\b/i,
    /\bissue\b/i,
    /\berror\b/i,
    /\bfix\b/i,
    /\bdebug\b/i,
    /\balarm\b/i,
    /\bfailure\b/i,
    /\bnot\s+working\b/i,
    /\bwrong\b/i,
    /\bdegraded\b/i,
    /\broot\s*cause\b/i,
  ],
  general: [],
};

/** Entity patterns for extraction */
const ENTITY_PATTERNS: Array<{
  type: ExtractedEntity['type'];
  patterns: RegExp[];
}> = [
  {
    type: 'parameter',
    patterns: [
      /\b[a-z][a-zA-Z0-9]*(?:Threshold|Offset|Timer|Max|Min|Enable|Disable|Mode)\b/,
      /\b(?:p|param)[A-Z][a-zA-Z0-9]+\b/,
      /\bz[A-Z][a-zA-Z0-9]+\b/, // Ericsson parameter naming
    ],
  },
  {
    type: 'counter',
    patterns: [
      /\bpm[A-Z][a-zA-Z0-9]+\b/,
      /\bPM\.[A-Z][a-zA-Z0-9.]+\b/,
      /\b[A-Z]{2,}_[A-Z0-9_]+\b/,
    ],
  },
  {
    type: 'kpi',
    patterns: [
      /\b(?:Initial|E-RAB|RRC|S1|X2|Intra|Inter)\s*(?:Setup|Establish|Handover)\s*(?:Success|Failure)?\s*Rate\b/i,
      /\b(?:DL|UL)\s*(?:Throughput|Latency|BLER)\b/i,
      /\b(?:RSRP|RSRQ|SINR|CQI)\b/i,
    ],
  },
  {
    type: 'feature',
    patterns: [
      /\bFAJ\s*\d{7}\b/i,
      /\bCXC\s*\d{7}\b/i,
      /\b[A-Z]{2,4}-[A-Z]{2,4}-\d{3,5}\b/,
    ],
  },
  {
    type: 'cell',
    patterns: [
      /\b(?:cell|eNodeB|gNB|NRCell)\s*(?:Id|ID)?\s*[=:]?\s*\d+\b/i,
      /\b[A-Z]{2,3}\d{4,6}[A-Z]?\d?\b/,
    ],
  },
  {
    type: 'node',
    patterns: [
      /\b(?:eNodeB|gNB|NodeB|DU|CU)\s*(?:Id|ID)?\s*[=:]?\s*[\w-]+\b/i,
    ],
  },
  {
    type: 'alarm',
    patterns: [
      /\balarm\s*(?:Id|ID)?\s*[=:]?\s*\d+\b/i,
      /\b(?:Major|Minor|Critical|Warning)\s*Alarm\b/i,
      /\bSP\s*\d+\b/,
    ],
  },
];

/**
 * IntentClassifier classifies query intent and extracts entities
 */
export class IntentClassifier {
  private readonly config: IntentClassifierConfig;

  constructor(config: Partial<IntentClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify query intent
   */
  classify(query: string): IntentClassification {
    const scores = new Map<QueryType, number>();

    // Calculate score for each intent
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        const matches = query.match(pattern);
        if (matches) {
          score += 1;
        }
      }
      scores.set(intent as QueryType, score);
    }

    // Find best intent
    let bestIntent: QueryType = 'general';
    let bestScore = 0;
    let totalScore = 0;

    for (const [intent, score] of scores) {
      totalScore += score;
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    // Calculate confidence
    const confidence = totalScore > 0 ? bestScore / totalScore : 0;

    // Get alternative intents
    const alternativeIntents: Array<{ intent: QueryType; confidence: number }> = [];
    for (const [intent, score] of scores) {
      if (intent !== bestIntent && score > 0) {
        alternativeIntents.push({
          intent,
          confidence: score / totalScore,
        });
      }
    }

    // Sort alternatives by confidence
    alternativeIntents.sort((a, b) => b.confidence - a.confidence);

    // If no strong match, default to general with low confidence
    if (bestScore === 0) {
      return {
        intent: 'general',
        confidence: 0.5,
        alternativeIntents: [],
      };
    }

    return {
      intent: bestIntent,
      confidence: Math.min(1, confidence + 0.3), // Boost confidence slightly
      alternativeIntents: alternativeIntents.slice(0, 3),
    };
  }

  /**
   * Extract entities from query
   */
  extractEntities(query: string): ExtractedEntity[] {
    if (!this.config.enableEntityExtraction) {
      return [];
    }

    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>();

    for (const { type, patterns } of ENTITY_PATTERNS) {
      for (const pattern of patterns) {
        const globalPattern = new RegExp(pattern.source, 'gi');
        let match;

        while ((match = globalPattern.exec(query)) !== null) {
          const value = match[0];
          const key = `${type}:${value.toLowerCase()}`;

          if (!seen.has(key)) {
            seen.add(key);
            entities.push({
              type,
              value,
              confidence: 0.8, // Fixed confidence for pattern matches
              position: {
                start: match.index,
                end: match.index + value.length,
              },
            });
          }
        }
      }
    }

    // Sort by position
    entities.sort((a, b) => a.position.start - b.position.start);

    return entities;
  }

  /**
   * Analyze query (classify + extract)
   */
  analyze(query: string): {
    classification: IntentClassification;
    entities: ExtractedEntity[];
  } {
    return {
      classification: this.classify(query),
      entities: this.extractEntities(query),
    };
  }

  /**
   * Check if query is a question
   */
  isQuestion(query: string): boolean {
    return /\?$/.test(query.trim()) ||
      /^(?:what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\b/i.test(query.trim());
  }

  /**
   * Estimate query complexity based on analysis
   */
  estimateComplexity(
    query: string,
    entities: ExtractedEntity[]
  ): 'simple' | 'moderate' | 'complex' {
    const wordCount = query.split(/\s+/).length;
    const entityCount = entities.length;
    const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1;
    const hasConditionals = /\b(if|when|unless|while|whether|assuming)\b/i.test(query);
    const hasTechnicalTerms = /\b(optimization|configuration|troubleshooting|analysis)\b/i.test(query);

    let complexityScore = 0;

    if (wordCount > 30) complexityScore += 2;
    else if (wordCount > 15) complexityScore += 1;

    if (entityCount > 3) complexityScore += 2;
    else if (entityCount > 1) complexityScore += 1;

    if (hasMultipleQuestions) complexityScore += 1;
    if (hasConditionals) complexityScore += 1;
    if (hasTechnicalTerms) complexityScore += 1;

    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }
}

// Export singleton
export const intentClassifier = new IntentClassifier();
