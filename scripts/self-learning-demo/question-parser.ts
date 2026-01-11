#!/usr/bin/env bun
/**
 * Question Parser Module
 *
 * Parses the 250 RAN feature questions from the structured markdown file
 * for use in the Battle Arena evaluation system.
 *
 * Question Format in Markdown:
 *   ### Q{n}-{ACRONYM}-{TYPE}
 *   "Question text here"
 *
 * Categories:
 *   - Category A (Q1-Q125): Knowledge Retrieval
 *   - Category B (Q126-Q200): Decision Making
 *   - Category C (Q201-Q250): Advanced Troubleshooting
 *
 * Types:
 *   - K01/K02/K03: Knowledge questions
 *   - D01: Decision questions
 *   - A01: Advanced/troubleshooting questions
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export type QuestionType = 'K' | 'D' | 'A';
export type QuestionCategory = 'A' | 'B' | 'C';

export interface ParsedQuestion {
    id: string;              // e.g., "Q1-MSM-K01"
    number: number;          // 1-250
    featureAcronym: string;  // e.g., "MSM"
    questionType: QuestionType;  // K=Knowledge, D=Decision, A=Advanced
    category: QuestionCategory;  // A, B, or C
    question: string;        // The actual question text
    featureName?: string;    // Full feature name if available
    featureNumber?: number;  // Feature section number (1-50)
}

export interface FeatureSection {
    number: number;
    acronym: string;
    name: string;
    faj?: string;            // FAJ code if present
    questions: ParsedQuestion[];
}

export interface ParseResult {
    totalQuestions: number;
    categoryA: ParsedQuestion[];  // Knowledge Retrieval (Q1-Q125)
    categoryB: ParsedQuestion[];  // Decision Making (Q126-Q200)
    categoryC: ParsedQuestion[];  // Advanced Troubleshooting (Q201-Q250)
    features: FeatureSection[];
    byAcronym: Map<string, ParsedQuestion[]>;
}

// ============================================================================
// Category Assignment
// ============================================================================

/**
 * Determine category based on question number
 */
function getCategory(questionNumber: number): QuestionCategory {
    if (questionNumber <= 125) return 'A';  // Knowledge Retrieval
    if (questionNumber <= 200) return 'B';  // Decision Making
    return 'C';  // Advanced Troubleshooting
}

/**
 * Get category name for display
 */
export function getCategoryName(category: QuestionCategory): string {
    switch (category) {
        case 'A': return 'Knowledge Retrieval';
        case 'B': return 'Decision Making';
        case 'C': return 'Advanced Troubleshooting';
    }
}

/**
 * Get question type full name
 */
export function getTypeName(type: QuestionType): string {
    switch (type) {
        case 'K': return 'Knowledge';
        case 'D': return 'Decision';
        case 'A': return 'Advanced';
    }
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse questions from the 250-questions.md file
 */
export function parseQuestionsFromMarkdown(filePath: string): ParseResult {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Questions file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const questions: ParsedQuestion[] = [];
    const features: FeatureSection[] = [];
    const byAcronym = new Map<string, ParsedQuestion[]>();

    let currentFeature: FeatureSection | null = null;

    // Regex patterns
    const featureHeaderPattern = /^## (\d+)\. ([A-Z0-9\-]+) - (.+?)(?: \(FAJ [\d ]+\))?$/;
    const questionIdPattern = /^### (Q(\d+)-([A-Z0-9]+)-([KDA])(\d+))$/;
    const questionTextPattern = /^"(.+)"$/;

    let lastQuestionId: string | null = null;
    let lastQuestionMeta: {
        id: string;
        number: number;
        acronym: string;
        type: QuestionType;
        typeNum: string;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for feature section header
        const featureMatch = line.match(featureHeaderPattern);
        if (featureMatch) {
            const [, numStr, acronym, name] = featureMatch;
            const fajMatch = line.match(/\(FAJ ([\d ]+)\)/);

            currentFeature = {
                number: parseInt(numStr, 10),
                acronym,
                name: name.trim(),
                faj: fajMatch?.[1],
                questions: [],
            };
            features.push(currentFeature);
            continue;
        }

        // Check for question ID header
        const questionIdMatch = line.match(questionIdPattern);
        if (questionIdMatch) {
            const [, id, numStr, acronym, typeChar, typeNum] = questionIdMatch;
            lastQuestionId = id;
            lastQuestionMeta = {
                id,
                number: parseInt(numStr, 10),
                acronym,
                type: typeChar as QuestionType,
                typeNum,
            };
            continue;
        }

        // Check for question text (must follow a question ID)
        const questionTextMatch = line.match(questionTextPattern);
        if (questionTextMatch && lastQuestionMeta) {
            const [, questionText] = questionTextMatch;

            const question: ParsedQuestion = {
                id: lastQuestionMeta.id,
                number: lastQuestionMeta.number,
                featureAcronym: lastQuestionMeta.acronym,
                questionType: lastQuestionMeta.type,
                category: getCategory(lastQuestionMeta.number),
                question: questionText,
                featureName: currentFeature?.name,
                featureNumber: currentFeature?.number,
            };

            questions.push(question);

            // Add to current feature
            if (currentFeature) {
                currentFeature.questions.push(question);
            }

            // Add to acronym map
            if (!byAcronym.has(lastQuestionMeta.acronym)) {
                byAcronym.set(lastQuestionMeta.acronym, []);
            }
            byAcronym.get(lastQuestionMeta.acronym)!.push(question);

            lastQuestionMeta = null;
            lastQuestionId = null;
        }
    }

    // Categorize questions
    const categoryA = questions.filter(q => q.category === 'A');
    const categoryB = questions.filter(q => q.category === 'B');
    const categoryC = questions.filter(q => q.category === 'C');

    return {
        totalQuestions: questions.length,
        categoryA,
        categoryB,
        categoryC,
        features,
        byAcronym,
    };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get questions by category
 */
export function getQuestionsByCategory(
    questions: ParsedQuestion[],
    category: QuestionCategory
): ParsedQuestion[] {
    return questions.filter(q => q.category === category);
}

/**
 * Get questions by feature acronym
 */
export function getQuestionsByFeature(
    questions: ParsedQuestion[],
    acronym: string
): ParsedQuestion[] {
    return questions.filter(q =>
        q.featureAcronym.toUpperCase() === acronym.toUpperCase()
    );
}

/**
 * Get questions by type
 */
export function getQuestionsByType(
    questions: ParsedQuestion[],
    type: QuestionType
): ParsedQuestion[] {
    return questions.filter(q => q.questionType === type);
}

/**
 * Get a random sample of questions
 */
export function sampleQuestions(
    questions: ParsedQuestion[],
    count: number
): ParsedQuestion[] {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get questions for a specific range
 */
export function getQuestionsInRange(
    questions: ParsedQuestion[],
    startNum: number,
    endNum: number
): ParsedQuestion[] {
    return questions.filter(q => q.number >= startNum && q.number <= endNum);
}

/**
 * Get all unique feature acronyms
 */
export function getFeatureAcronyms(parseResult: ParseResult): string[] {
    return Array.from(parseResult.byAcronym.keys());
}

// ============================================================================
// Statistics
// ============================================================================

export interface QuestionStats {
    total: number;
    byCategory: Record<QuestionCategory, number>;
    byType: Record<QuestionType, number>;
    byFeature: { acronym: string; count: number }[];
    averageQuestionLength: number;
}

/**
 * Calculate statistics for parsed questions
 */
export function calculateStats(parseResult: ParseResult): QuestionStats {
    const allQuestions = [
        ...parseResult.categoryA,
        ...parseResult.categoryB,
        ...parseResult.categoryC,
    ];

    const byType: Record<QuestionType, number> = { K: 0, D: 0, A: 0 };
    let totalLength = 0;

    for (const q of allQuestions) {
        byType[q.questionType]++;
        totalLength += q.question.length;
    }

    const byFeature = parseResult.features.map(f => ({
        acronym: f.acronym,
        count: f.questions.length,
    }));

    return {
        total: parseResult.totalQuestions,
        byCategory: {
            A: parseResult.categoryA.length,
            B: parseResult.categoryB.length,
            C: parseResult.categoryC.length,
        },
        byType,
        byFeature,
        averageQuestionLength: totalLength / allQuestions.length || 0,
    };
}

// ============================================================================
// Default Export & CLI
// ============================================================================

export default {
    parseQuestionsFromMarkdown,
    getQuestionsByCategory,
    getQuestionsByFeature,
    getQuestionsByType,
    sampleQuestions,
    getQuestionsInRange,
    getFeatureAcronyms,
    calculateStats,
    getCategoryName,
    getTypeName,
};

// CLI for testing
if (import.meta.main) {
    const COLORS = {
        reset: '\x1b[0m',
        bold: '\x1b[1m',
        dim: '\x1b[2m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        cyan: '\x1b[36m',
        magenta: '\x1b[35m',
    };

    const defaultPath = path.join(process.cwd(), 'docs/ran-domain/250-questions.md');
    const filePath = process.argv[2] || defaultPath;

    console.log(`${COLORS.cyan}Parsing questions from: ${filePath}${COLORS.reset}\n`);

    try {
        const result = parseQuestionsFromMarkdown(filePath);
        const stats = calculateStats(result);

        console.log(`${COLORS.bold}Parse Results:${COLORS.reset}`);
        console.log(`  Total Questions: ${COLORS.green}${stats.total}${COLORS.reset}`);
        console.log(`  Features: ${result.features.length}`);

        console.log(`\n${COLORS.yellow}By Category:${COLORS.reset}`);
        console.log(`  📚 Category A (Knowledge):     ${stats.byCategory.A} questions`);
        console.log(`  🎯 Category B (Decision):      ${stats.byCategory.B} questions`);
        console.log(`  🔧 Category C (Advanced):      ${stats.byCategory.C} questions`);

        console.log(`\n${COLORS.magenta}By Type:${COLORS.reset}`);
        console.log(`  K (Knowledge):  ${stats.byType.K} questions`);
        console.log(`  D (Decision):   ${stats.byType.D} questions`);
        console.log(`  A (Advanced):   ${stats.byType.A} questions`);

        console.log(`\n${COLORS.cyan}Sample Questions:${COLORS.reset}`);
        const samples = sampleQuestions([...result.categoryA, ...result.categoryB, ...result.categoryC], 3);
        for (const q of samples) {
            console.log(`  ${COLORS.dim}[${q.id}]${COLORS.reset} ${q.question.substring(0, 70)}...`);
        }

        console.log(`\n${COLORS.green}✓ Parse complete${COLORS.reset}`);
    } catch (error) {
        console.error(`Error parsing questions:`, error);
        process.exit(1);
    }
}
