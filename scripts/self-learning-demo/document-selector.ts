#!/usr/bin/env bun
/**
 * Document Selector Module
 * 
 * Randomly selects 25 Ericsson RAN feature documents and generates
 * specific questions for each. Maintains selection history to ensure
 * variety across demo runs.
 * 
 * Part of the Advanced Multi-Agent Self-Learning Demo
 */

import * as fs from 'fs';
import * as path from 'path';
import AgentDBBridge from './agentdb-bridge.js';

// ============================================================================
// Types
// ============================================================================

export interface FeatureDocument {
    id: string;
    path: string;
    name: string;
    acronym: string;
    domain: string;
    description: string;
    content?: string;
}

export interface GeneratedQuestion {
    id: string;
    documentId: string;
    category: 'Knowledge' | 'Decision' | 'Troubleshooting';
    type: 'Parametric' | 'Conceptual' | 'Procedural' | 'Analytical';
    question: string;
    complexity: 'Basic' | 'Intermediate' | 'Advanced';
    expectedTopics: string[];
}

export interface DocumentSelection {
    timestamp: number;
    documents: FeatureDocument[];
    questions: GeneratedQuestion[];
    selectionId: string;
}

// ============================================================================
// Constants
// ============================================================================

const DOCS_BASE_PATH = path.join(process.cwd(), 'docs/elex_features');
const SELECTION_COUNT = 25;

// RAN Feature Domains for classification
const RAN_DOMAINS: Record<string, string[]> = {
    'Carrier Aggregation': ['CA', 'IECA', 'UCA', 'DCA', 'SCC', 'PCC'],
    'MIMO & Antenna': ['MIMO', 'TM8', 'TM9', '4x4', 'BF', 'AAS', 'MUIMO'],
    'Radio Resource Management': ['RRM', 'DFSS', 'PSS', 'DUAC', 'IFLB', 'DUH'],
    'Mobility': ['HO', 'ULOHM', 'IRO', 'CSFB', 'MFBI'],
    'Energy Saving': ['MSM', 'MST', 'EE', 'SLEEP'],
    'Coverage & Capacity': ['CCCH', 'P', 'RACH', 'PUCCH'],
    'Transport': ['X2', 'S1', 'ROHC', 'RHC', 'IP'],
    'Interference': ['ICIC', 'COMP', 'UIR'],
    'Voice & IMS': ['VOLTE', 'VFH', 'SRVCC', 'CSFB'],
    'Security': ['SEC', 'AUTH', 'ENC'],
    'QoS': ['QCI', 'ARP', 'GBR', 'MBR', 'AMBR'],
    'Timing': ['GPS', 'PTP', 'SYNC'],
    'SON': ['ANR', 'MRO', 'PCI'],
    'NR/5G': ['NR', 'NSA', 'DSS', 'EN-DC'],
    'UE Handling': ['PIUM', 'HSU', 'DRX', 'SSIT'],
};

// Question templates by category and type
const QUESTION_TEMPLATES = {
    Knowledge: {
        Conceptual: [
            'What is the purpose of {feature}? How does it differ from {related}?',
            'Explain the key concepts behind {feature} and its role in {domain}.',
            'What are the main benefits of enabling {feature} in a production environment?',
            'How does {feature} interact with other {domain} features?',
        ],
        Parametric: [
            'What are the key parameters that control {feature} behavior?',
            'What are the valid ranges and default values for {feature} configuration?',
            'Which MO classes are involved in configuring {feature}?',
            'How do you verify {feature} is properly activated through parameters?',
        ],
    },
    Decision: {
        Analytical: [
            'Under what network conditions should {feature} be enabled or disabled?',
            'What KPIs indicate that {feature} is providing expected benefits?',
            'How do you determine optimal parameter settings for {feature}?',
            'When should {feature} be preferred over {alternative} approach?',
        ],
        Procedural: [
            'What is the recommended procedure for activating {feature}?',
            'What prerequisites must be met before enabling {feature}?',
            'How do you validate {feature} is working correctly after activation?',
            'What is the rollback procedure if {feature} causes issues?',
        ],
    },
    Troubleshooting: {
        Procedural: [
            'How do you troubleshoot when {feature} is not providing expected performance?',
            '{feature} activation is failing. What are the diagnostic steps?',
            'Users are experiencing issues after enabling {feature}. How do you investigate?',
            'What logs and counters should be checked when debugging {feature}?',
        ],
        Analytical: [
            '{feature} performance has degraded. What are potential causes and remediation steps?',
            'How do you identify conflicts between {feature} and other {domain} features?',
            'What alarm patterns indicate {feature} misconfiguration?',
            'How do you optimize {feature} when KPIs are below target?',
        ],
    },
};

// ============================================================================
// Document Discovery
// ============================================================================

/**
 * Recursively find all markdown files in the elex_features directory
 */
function findAllDocuments(): string[] {
    const documents: string[] = [];

    function scanDirectory(dirPath: string): void {
        if (!fs.existsSync(dirPath)) return;

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                scanDirectory(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                documents.push(fullPath);
            }
        }
    }

    scanDirectory(DOCS_BASE_PATH);
    return documents;
}

/**
 * Parse feature information from document path and content
 */
function parseFeatureDocument(filePath: string): FeatureDocument | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath, '.md');
        const relativePath = path.relative(DOCS_BASE_PATH, filePath);

        // Extract feature name from content (first heading)
        const headingMatch = content.match(/^#\s+(.+)$/m);
        const name = headingMatch?.[1] || fileName;

        // Try to extract acronym from file name or content
        const acronymMatch = name.match(/\b([A-Z]{2,6})\b/) ||
            content.match(/\b([A-Z]{2,6})\b/);
        const acronym = acronymMatch?.[1] || 'N/A';

        // Determine domain based on acronym or content keywords
        let domain = 'General RAN';
        for (const [domainName, keywords] of Object.entries(RAN_DOMAINS)) {
            if (keywords.some(kw =>
                acronym.includes(kw) ||
                name.toUpperCase().includes(kw) ||
                content.toUpperCase().includes(kw)
            )) {
                domain = domainName;
                break;
            }
        }

        // Extract description (second paragraph or first 200 chars)
        const descMatch = content.match(/\n\n([^#\n].{20,200})/);
        const description = descMatch?.[1]?.trim() ||
            content.substring(0, 200).replace(/[#\n]/g, ' ').trim();

        return {
            id: fileName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30),
            path: relativePath,
            name: name.substring(0, 80),
            acronym,
            domain,
            description: description.substring(0, 200),
            content: content.substring(0, 5000), // Store first 5000 chars for question generation
        };
    } catch (error) {
        console.error(`Failed to parse ${filePath}:`, error);
        return null;
    }
}

// ============================================================================
// Random Selection
// ============================================================================

/**
 * Generate a random selection of documents
 */
export function selectRandomDocuments(count: number = SELECTION_COUNT): FeatureDocument[] {
    const allPaths = findAllDocuments();

    if (allPaths.length === 0) {
        console.warn('No documents found in', DOCS_BASE_PATH);
        return [];
    }

    // Shuffle using Fisher-Yates algorithm
    const shuffled = [...allPaths];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Take first N and parse
    const selected = shuffled.slice(0, count);
    const documents: FeatureDocument[] = [];

    for (const docPath of selected) {
        const doc = parseFeatureDocument(docPath);
        if (doc) {
            documents.push(doc);
        }
    }

    return documents;
}

/**
 * Select documents with domain diversity
 */
export function selectDiverseDocuments(count: number = SELECTION_COUNT): FeatureDocument[] {
    const allPaths = findAllDocuments();

    if (allPaths.length === 0) {
        return [];
    }

    // Parse all documents first
    const allDocs = allPaths
        .map(p => parseFeatureDocument(p))
        .filter((d): d is FeatureDocument => d !== null);

    // Group by domain
    const byDomain: Record<string, FeatureDocument[]> = {};
    for (const doc of allDocs) {
        if (!byDomain[doc.domain]) {
            byDomain[doc.domain] = [];
        }
        byDomain[doc.domain].push(doc);
    }

    // Select proportionally from each domain
    const domains = Object.keys(byDomain);
    const perDomain = Math.ceil(count / domains.length);
    const selected: FeatureDocument[] = [];

    for (const domain of domains) {
        const domainDocs = byDomain[domain];
        // Shuffle domain docs
        for (let i = domainDocs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [domainDocs[i], domainDocs[j]] = [domainDocs[j], domainDocs[i]];
        }
        // Take up to perDomain from this domain
        const toTake = Math.min(perDomain, domainDocs.length);
        selected.push(...domainDocs.slice(0, toTake));

        if (selected.length >= count) break;
    }

    // Shuffle final selection
    for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    return selected.slice(0, count);
}

// ============================================================================
// Question Generation
// ============================================================================

/**
 * Generate questions for a document
 */
export function generateQuestionsForDocument(
    doc: FeatureDocument,
    questionsPerDoc: number = 3
): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    const categories = Object.keys(QUESTION_TEMPLATES) as Array<keyof typeof QUESTION_TEMPLATES>;

    for (let i = 0; i < questionsPerDoc; i++) {
        // Rotate through categories
        const category = categories[i % categories.length];
        const categoryTemplates = QUESTION_TEMPLATES[category];
        const types = Object.keys(categoryTemplates) as Array<keyof typeof categoryTemplates>;
        const type = types[i % types.length];
        const templates = categoryTemplates[type];

        // Pick a random template
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Fill in template
        const question = template
            .replace(/{feature}/g, doc.name)
            .replace(/{acronym}/g, doc.acronym)
            .replace(/{domain}/g, doc.domain)
            .replace(/{related}/g, `other ${doc.domain} features`)
            .replace(/{alternative}/g, 'conventional approaches');

        // Determine complexity based on category
        const complexity = category === 'Knowledge' ? 'Basic'
            : category === 'Decision' ? 'Intermediate'
                : 'Advanced';

        questions.push({
            id: `${doc.id}_Q${i + 1}`,
            documentId: doc.id,
            category,
            type: type as 'Parametric' | 'Conceptual' | 'Procedural' | 'Analytical',
            question,
            complexity,
            expectedTopics: [doc.name, doc.domain, doc.acronym].filter(t => t && t !== 'N/A'),
        });
    }

    return questions;
}

/**
 * Generate all questions for a document selection
 */
export function generateAllQuestions(
    documents: FeatureDocument[],
    questionsPerDoc: number = 3
): GeneratedQuestion[] {
    const allQuestions: GeneratedQuestion[] = [];

    for (const doc of documents) {
        const docQuestions = generateQuestionsForDocument(doc, questionsPerDoc);
        allQuestions.push(...docQuestions);
    }

    return allQuestions;
}

// ============================================================================
// Selection Management
// ============================================================================

/**
 * Create a complete document selection with questions
 */
export async function createDocumentSelection(
    count: number = SELECTION_COUNT,
    questionsPerDoc: number = 3,
    diverse: boolean = true
): Promise<DocumentSelection> {
    const documents = diverse
        ? selectDiverseDocuments(count)
        : selectRandomDocuments(count);

    const questions = generateAllQuestions(documents, questionsPerDoc);

    const selection: DocumentSelection = {
        timestamp: Date.now(),
        documents,
        questions,
        selectionId: `selection_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };

    // Store selection in AgentDB
    await AgentDBBridge.initialize();
    await AgentDBBridge.store(
        `selection:${selection.selectionId}`,
        selection,
        'elex-knowledge'
    );

    return selection;
}

/**
 * Load previous selection from AgentDB
 */
export async function loadPreviousSelection(
    selectionId: string
): Promise<DocumentSelection | null> {
    await AgentDBBridge.initialize();
    return AgentDBBridge.retrieve(
        `selection:${selectionId}`,
        'elex-knowledge'
    );
}

/**
 * Get summary of available documents
 */
export function getDocumentsSummary(): {
    totalDocuments: number;
    byDomain: Record<string, number>;
    sampleDocuments: FeatureDocument[];
} {
    const allPaths = findAllDocuments();
    const allDocs = allPaths
        .slice(0, 100) // Sample first 100 for efficiency
        .map(p => parseFeatureDocument(p))
        .filter((d): d is FeatureDocument => d !== null);

    const byDomain: Record<string, number> = {};
    for (const doc of allDocs) {
        byDomain[doc.domain] = (byDomain[doc.domain] || 0) + 1;
    }

    return {
        totalDocuments: allPaths.length,
        byDomain,
        sampleDocuments: allDocs.slice(0, 5),
    };
}

// ============================================================================
// Acronym-Based Document Lookup (for 250 Questions Integration)
// ============================================================================

/**
 * Build a mapping of acronyms to documents
 * This caches all documents indexed by their acronym for fast lookup
 */
let _acronymCache: Map<string, FeatureDocument> | null = null;

function buildAcronymCache(): Map<string, FeatureDocument> {
    if (_acronymCache) return _acronymCache;

    const allPaths = findAllDocuments();
    _acronymCache = new Map();

    for (const docPath of allPaths) {
        const doc = parseFeatureDocument(docPath);
        if (doc && doc.acronym && doc.acronym !== 'N/A') {
            // Store by primary acronym
            _acronymCache.set(doc.acronym.toUpperCase(), doc);

            // Also store common variations
            // Handle cases like "MSM" -> "MIMO Sleep Mode"
            // Handle compound acronyms like "4QADPP4x4" -> "4QADPP4x4"
            const variations = [
                doc.acronym.toUpperCase(),
                doc.acronym.replace(/-/g, '').toUpperCase(),
                doc.acronym.replace(/\d+/g, '').toUpperCase(),
            ];

            for (const v of variations) {
                if (v && !_acronymCache.has(v)) {
                    _acronymCache.set(v, doc);
                }
            }
        }
    }

    return _acronymCache;
}

/**
 * Get a document by its feature acronym
 */
export function getDocumentByAcronym(acronym: string): FeatureDocument | null {
    const cache = buildAcronymCache();
    const normalized = acronym.toUpperCase().replace(/-/g, '');

    // Try exact match first
    if (cache.has(normalized)) {
        return cache.get(normalized)!;
    }

    // Try partial match (for compound acronyms like "UTAIFLB" -> "UTA-IFLB")
    for (const [key, doc] of cache) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return doc;
        }
    }

    // Try matching by document name containing the acronym
    for (const [, doc] of cache) {
        if (doc.name.toUpperCase().includes(normalized)) {
            return doc;
        }
    }

    return null;
}

/**
 * Interface for parsed questions (minimal type for compatibility)
 */
interface MinimalParsedQuestion {
    id: string;
    featureAcronym: string;
}

/**
 * Get documents for a list of parsed questions
 * Returns a map of question ID to its corresponding feature document
 */
export function getDocumentsForQuestions<T extends MinimalParsedQuestion>(
    questions: T[]
): Map<string, FeatureDocument> {
    const result = new Map<string, FeatureDocument>();
    const cache = buildAcronymCache();

    for (const question of questions) {
        const doc = getDocumentByAcronym(question.featureAcronym);
        if (doc) {
            result.set(question.id, doc);
        }
    }

    return result;
}

/**
 * Get all unique acronyms we have documents for
 */
export function getAllDocumentAcronyms(): string[] {
    const cache = buildAcronymCache();
    return Array.from(new Set(
        Array.from(cache.values()).map(d => d.acronym)
    )).filter(a => a && a !== 'N/A');
}

/**
 * Clear the acronym cache (useful for testing)
 */
export function clearAcronymCache(): void {
    _acronymCache = null;
}

export default {
    selectRandomDocuments,
    selectDiverseDocuments,
    generateQuestionsForDocument,
    generateAllQuestions,
    createDocumentSelection,
    loadPreviousSelection,
    getDocumentsSummary,
    getDocumentByAcronym,
    getDocumentsForQuestions,
    getAllDocumentAcronyms,
    clearAcronymCache,
};
