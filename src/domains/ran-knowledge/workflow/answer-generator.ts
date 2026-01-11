/**
 * Answer Generator with Confidence Scoring
 *
 * Formats responses with confidence scores and source attribution.
 * Ensures answers are clear, actionable, and properly sourced.
 *
 * @module workflow/answer-generator
 */

import type { FeatureKnowledge } from './feature-specialist';

/**
 * Answer Generator Configuration
 */
export interface AnswerGeneratorConfig {
  maxSources?: number; // Default: 5
  formatResponse?: boolean; // Default: true
  includeMetadata?: boolean; // Default: true
}

/**
 * Answer Generation Context
 */
export interface AnswerGenerationContext {
  decision: 'DirectAnswer' | 'ContextAnswer' | 'ConsultPeer' | 'RequestClarification' | 'Escalate';
  question: string;
  knowledge: FeatureKnowledge;
  confidence: number;
}

/**
 * Generated Answer
 */
export interface GeneratedAnswer {
  content: string;
  confidence: number;
  sources: string[];
  metadata?: {
    action: string;
    agentsConsulted: number;
    parametersFound: number;
    countersFound: number;
    kpisFound: number;
  };
}

/**
 * Answer Generator
 *
 * Formats responses with confidence scoring and proper source attribution
 */
export class AnswerGenerator {
  private config: AnswerGeneratorConfig;

  // Statistics
  private stats = {
    totalGenerated: 0,
    avgConfidence: 0,
    avgSources: 0,
    byAction: {
      DirectAnswer: 0,
      ContextAnswer: 0,
      ConsultPeer: 0,
      RequestClarification: 0,
      Escalate: 0,
    },
  };

  constructor(config: AnswerGeneratorConfig = {}) {
    this.config = {
      maxSources: config.maxSources ?? 5,
      formatResponse: config.formatResponse ?? true,
      includeMetadata: config.includeMetadata ?? true,
    };
  }

  /**
   * Generate answer based on decision and context
   */
  async generate(context: AnswerGenerationContext): Promise<GeneratedAnswer> {
    this.stats.totalGenerated++;

    const sources = this.extractSources(context.knowledge, this.config.maxSources ?? 5);

    let content: string;

    switch (context.decision) {
      case 'DirectAnswer':
        content = this.generateDirectAnswer(context);
        break;
      case 'ContextAnswer':
        content = this.generateContextAnswer(context);
        break;
      case 'ConsultPeer':
        content = this.generateConsultPeerAnswer(context);
        break;
      case 'RequestClarification':
        content = this.generateClarificationRequest(context);
        break;
      case 'Escalate':
        content = this.generateEscalationMessage(context);
        break;
    }

    // Update statistics
    this.updateStats(context.decision, context.confidence, sources.length);

    const answer: GeneratedAnswer = {
      content,
      confidence: context.confidence,
      sources,
    };

    if (this.config.includeMetadata) {
      answer.metadata = {
        action: context.decision,
        agentsConsulted: context.knowledge.agents.size,
        parametersFound: context.knowledge.relevantParameters.length,
        countersFound: context.knowledge.relevantCounters.length,
        kpisFound: context.knowledge.relevantKPIs.length,
      };
    }

    return answer;
  }

  /**
   * Get generator statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      avgConfidence: this.stats.avgConfidence.toFixed(3),
      avgSources: this.stats.avgSources.toFixed(1),
      actionDistribution: this.stats.byAction,
    };
  }

  // Private methods

  private extractSources(knowledge: FeatureKnowledge, maxSources: number): string[] {
    const sources: string[] = [];

    // Add feature agents as sources
    for (const [agentId, agentKnowledge] of knowledge.agents) {
      sources.push(`${agentKnowledge.featureName} (${agentKnowledge.fajCode})`);
      if (sources.length >= maxSources) break;
    }

    return sources;
  }

  private generateDirectAnswer(context: AnswerGenerationContext): string {
    const { question, knowledge, confidence } = context;

    let answer = '';

    // Build answer from knowledge
    if (knowledge.relevantParameters.length > 0) {
      answer += this.formatParameterSection(knowledge.relevantParameters);
    }

    if (knowledge.relevantCounters.length > 0) {
      answer += (answer ? '\n\n' : '') + this.formatCounterSection(knowledge.relevantCounters);
    }

    if (knowledge.relevantKPIs.length > 0) {
      answer += (answer ? '\n\n' : '') + this.formatKPISection(knowledge.relevantKPIs);
    }

    // Add contextual info
    if (knowledge.contextualInfo.length > 0) {
      answer += (answer ? '\n\n' : '') + '**Context:**\n' + knowledge.contextualInfo.join('\n');
    }

    // If no specific knowledge found, provide general response
    if (!answer) {
      answer = `Based on the available feature knowledge, I found relevant information for your question about "${question}".\n\n`;
      answer += `I've identified ${knowledge.agents.size} relevant feature agents that can help address your query.`;
    }

    return answer;
  }

  private generateContextAnswer(context: AnswerGenerationContext): string {
    const { question, knowledge, confidence } = context;

    let answer = `**Contextual Answer**\n\n`;
    answer += `For your question: "${question}"\n\n`;

    answer += `I've analyzed ${knowledge.agents.size} feature agents and found relevant information:\n\n`;

    if (knowledge.relevantParameters.length > 0) {
      answer += this.formatParameterSection(knowledge.relevantParameters);
    }

    if (knowledge.relevantCounters.length > 0) {
      answer += '\n' + this.formatCounterSection(knowledge.relevantCounters);
    }

    answer += `\n**Note:** This answer is based on ${knowledge.agents.size} feature agents. `;
    answer += `For more specific information, please provide additional context.`;

    return answer;
  }

  private generateConsultPeerAnswer(context: AnswerGenerationContext): string {
    const { question, knowledge, confidence } = context;

    let answer = `**Peer Consultation**\n\n`;
    answer += `Your question: "${question}"\n\n`;
    answer += `I'm consulting with ${knowledge.agents.size} feature specialists to provide a comprehensive answer.\n\n`;

    answer += `**Relevant Features:**\n`;
    for (const [agentId, agentKnowledge] of knowledge.agents) {
      answer += `- ${agentKnowledge.featureName} (${agentKnowledge.fajCode})\n`;
    }

    if (knowledge.relevantParameters.length > 0) {
      answer += `\n**Related Parameters:**\n`;
      for (const param of knowledge.relevantParameters.slice(0, 5)) {
        answer += `- ${param.name} (${param.fajCode})\n`;
      }
    }

    answer += `\n**Confidence:** ${(confidence * 100).toFixed(1)}%\n`;
    answer += `\nThis answer involves cross-feature coordination. For critical operations, please verify with the relevant technical documentation.`;

    return answer;
  }

  private generateClarificationRequest(context: AnswerGenerationContext): string {
    const { question, knowledge } = context;

    let answer = `**Clarification Needed**\n\n`;
    answer += `For your question: "${question}"\n\n`;
    answer += `I need more information to provide an accurate answer. Please clarify:\n\n`;

    if (knowledge.agents.size > 0) {
      answer += `1. **Feature Context:** Which specific feature are you asking about?\n`;
      answer += `   - ${Array.from(knowledge.agents.values()).map(a => a.featureName).join('\n   - ')}\n\n`;
    }

    answer += `2. **Use Case:** What are you trying to achieve?\n`;
    answer += `3. **Environment:** What is your current network configuration?\n`;
    answer += `4. **Scope:** Are you looking for configuration, troubleshooting, or optimization guidance?\n\n`;

    answer += `**Current Context Found:**\n`;
    answer += `- ${knowledge.agents.size} potential feature agents identified\n`;
    answer += `- ${knowledge.relevantParameters.length} related parameters\n`;
    answer += `- ${knowledge.relevantCounters.length} related counters\n`;

    return answer;
  }

  private generateEscalationMessage(context: AnswerGenerationContext): string {
    const { question, knowledge } = context;

    let answer = `**Escalation Required**\n\n`;
    answer += `For your question: "${question}"\n\n`;
    answer += `This query requires escalation to a human expert or specialized system.\n\n`;

    answer += `**Reason for Escalation:**\n`;
    answer += `- Insufficient automated knowledge available\n`;
    answer += `- Complex or critical nature of the query\n`;
    answer += `- Potential safety or compliance implications\n\n`;

    answer += `**What I Found:**\n`;
    answer += `- ${knowledge.agents.size} feature agents partially matched\n`;
    answer += `- ${knowledge.relevantParameters.length} related parameters\n`;
    answer += `- ${knowledge.relevantCounters.length} related counters\n\n`;

    answer += `**Recommended Next Steps:**\n`;
    answer += `1. Consult the official Ericsson documentation\n`;
    answer += `2. Contact your RAN optimization team\n`;
    answer += `3. Review the relevant technical specifications\n`;
    answer += `4. For urgent matters, use the standard escalation channels\n\n`;

    answer += `**Reference Information:**\n`;
    if (knowledge.agents.size > 0) {
      for (const [agentId, agentKnowledge] of knowledge.agents) {
        answer += `- ${agentKnowledge.featureName} (${agentKnowledge.fajCode}): ${agentKnowledge.category}\n`;
      }
    }

    return answer;
  }

  private formatParameterSection(parameters: any[]): string {
    let section = '**Parameters:**\n';
    for (const param of parameters.slice(0, 5)) {
      section += `- **${param.name}** (${param.fajCode})\n`;
      if (param.safeZone) {
        section += `  - Range: ${param.safeZone.min} - ${param.safeZone.max} ${param.safeZone.unit}\n`;
      }
    }
    return section;
  }

  private formatCounterSection(counters: any[]): string {
    let section = '**Counters:**\n';
    for (const counter of counters.slice(0, 5)) {
      section += `- **${counter.name}** (${counter.fajCode})\n`;
    }
    return section;
  }

  private formatKPISection(kpis: any[]): string {
    let section = '**KPIs:**\n';
    for (const kpi of kpis.slice(0, 5)) {
      section += `- **${kpi.name}** (${kpi.fajCode})\n`;
      if (kpi.formula !== 'N/A') {
        section += `  - Formula: ${kpi.formula}\n`;
      }
      if (kpi.threshold !== undefined) {
        section += `  - Threshold: ${kpi.threshold}\n`;
      }
    }
    return section;
  }

  private updateStats(action: string, confidence: number, sources: number): void {
    this.stats.byAction[action as keyof typeof this.stats.byAction]++;

    const alpha = 0.1;
    this.stats.avgConfidence = alpha * confidence + (1 - alpha) * this.stats.avgConfidence;
    this.stats.avgSources = alpha * sources + (1 - alpha) * this.stats.avgSources;
  }
}

export type {
  AnswerGeneratorConfig,
  AnswerGenerationContext,
  GeneratedAnswer,
};
