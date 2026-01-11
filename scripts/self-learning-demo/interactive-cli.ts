#!/usr/bin/env bun
/**
 * Advanced Multi-Agent Self-Learning Demo - Interactive CLI
 * 
 * An interactive demo showcasing 25 randomly selected Ericsson RAN feature documents
 * with dedicated agents answering specific questions and self-learning with AgentDB memory.
 * 
 * Features:
 * - 25 randomly selected Ericsson documents with generated questions
 * - Dedicated agents per feature with Q-learning optimization
 * - AgentDB memory persistence for continuous learning
 * - Federated knowledge sharing between domain agents
 * - 4-step reasoning pipeline (RETRIEVE → JUDGE → DISTILL → CONSOLIDATE)
 * - Real-time performance statistics and swarm metrics
 * 
 * Usage:
 *   bun run scripts/self-learning-demo/interactive-cli.ts [options]
 * 
 * Options:
 *   --auto           Run automated demo without interaction
 *   --questions=N    Number of questions to process (default: all)
 *   --json           Output results in JSON format
 *   --benchmark      Run performance benchmark
 *   --help           Show this help message
 */

import * as readline from 'readline';
import { AgentSwarmManager, SwarmStatistics } from './swarm-manager.js';
import AgentDBBridge from './agentdb-bridge.js';
import { DocumentSelection, GeneratedQuestion } from './document-selector.js';

// ============================================================================
// CLI Configuration
// ============================================================================

interface CliOptions {
    auto: boolean;
    questions: number;
    json: boolean;
    benchmark: boolean;
    help: boolean;
}

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
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgMagenta: '\x1b[45m',
};

// ============================================================================
// CLI Helper Functions
// ============================================================================

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const options: CliOptions = {
        auto: false,
        questions: -1,
        json: false,
        benchmark: false,
        help: false,
    };

    for (const arg of args) {
        if (arg === '--auto') options.auto = true;
        else if (arg === '--json') options.json = true;
        else if (arg === '--benchmark') options.benchmark = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg.startsWith('--questions=')) {
            options.questions = parseInt(arg.split('=')[1], 10);
        }
    }

    return options;
}

function showHelp(): void {
    console.log(`
${COLORS.cyan}${COLORS.bold}Advanced Multi-Agent Self-Learning Demo${COLORS.reset}

${COLORS.yellow}Usage:${COLORS.reset}
  bun run scripts/self-learning-demo/interactive-cli.ts [options]

${COLORS.yellow}Options:${COLORS.reset}
  --auto           Run automated demo without interaction
  --questions=N    Number of questions to process (default: all)
  --json           Output results in JSON format
  --benchmark      Run performance benchmark
  --help           Show this help message

${COLORS.yellow}Features:${COLORS.reset}
  • 25 randomly selected Ericsson documents with generated questions
  • Dedicated agents per feature with Q-learning optimization
  • AgentDB memory persistence for continuous learning
  • Federated knowledge sharing between domain agents
  • 4-step reasoning pipeline

${COLORS.yellow}Interactive Commands:${COLORS.reset}
  1. Query Agent        - Ask any question to the swarm
  2. View Agents        - List all active agents
  3. Run Questions      - Process generated questions
  4. View Statistics    - Show swarm learning statistics
  5. Federated Sync     - Trigger knowledge sharing
  6. Benchmark          - Run performance test
  7. Exit

${COLORS.dim}Press Ctrl+C at any time to exit.${COLORS.reset}
`);
}

function printHeader(title: string): void {
    console.log(`\n${COLORS.bgBlue}${COLORS.white}${COLORS.bold}`);
    console.log(`  ${'═'.repeat(60)}  `);
    console.log(`  ${title.padEnd(60)}  `);
    console.log(`  ${'═'.repeat(60)}  `);
    console.log(`${COLORS.reset}\n`);
}

function printSection(title: string): void {
    console.log(`\n${COLORS.cyan}${COLORS.bold}▸ ${title}${COLORS.reset}`);
    console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`);
}

function printSuccess(message: string): void {
    console.log(`${COLORS.green}✓ ${message}${COLORS.reset}`);
}

function printWarning(message: string): void {
    console.log(`${COLORS.yellow}⚠ ${message}${COLORS.reset}`);
}

function printError(message: string): void {
    console.log(`${COLORS.red}✗ ${message}${COLORS.reset}`);
}

function printInfo(label: string, value: any): void {
    console.log(`  ${COLORS.dim}${label}:${COLORS.reset} ${value}`);
}

function formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

// ============================================================================
// Interactive CLI Class
// ============================================================================

class SelfLearningDemoCLI {
    private rl: readline.Interface;
    private swarm: AgentSwarmManager;
    private selection: DocumentSelection | null = null;
    private sessionStart: number;
    private queriesThisSession: number = 0;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        this.swarm = new AgentSwarmManager({
            maxAgents: 100,
            federatedSyncInterval: 60000,
            persistenceInterval: 30000,
            learningEnabled: true,
        });
        this.sessionStart = Date.now();
    }

    /**
     * Prompt for user input
     */
    private prompt(question: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(question, resolve);
        });
    }

    /**
     * Initialize the demo
     */
    async initialize(): Promise<void> {
        printHeader('ADVANCED MULTI-AGENT SELF-LEARNING DEMO');

        console.log(`${COLORS.cyan}Initializing swarm infrastructure...${COLORS.reset}\n`);

        // Initialize swarm
        await this.swarm.initialize();
        printSuccess('Swarm manager initialized');

        // Create agents from random document selection
        console.log(`\n${COLORS.yellow}Selecting 25 random Ericsson documents...${COLORS.reset}`);
        this.selection = await this.swarm.createAgentsFromNewSelection(25, 3);

        if (this.selection) {
            printSuccess(`Selected ${this.selection.documents.length} documents`);
            printSuccess(`Generated ${this.selection.questions.length} questions`);

            // Show domain distribution
            const domains: Record<string, number> = {};
            for (const doc of this.selection.documents) {
                domains[doc.domain] = (domains[doc.domain] || 0) + 1;
            }

            printSection('Domain Distribution');
            const maxCount = Math.max(...Object.values(domains), 1);
            for (const [domain, count] of Object.entries(domains).sort((a, b) => b[1] - a[1])) {
                const barLength = Math.min(10, Math.round((count / maxCount) * 10));
                const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
                console.log(`  ${COLORS.dim}${domain.padEnd(25)}${COLORS.reset} ${bar} ${count}`);
            }
        }

        // Start automation
        this.swarm.startAutomation();
        printSuccess('Federated sync and persistence automation started');
    }

    /**
     * Display main menu
     */
    private async showMainMenu(): Promise<string> {
        console.log(`
${COLORS.magenta}${COLORS.bold}╔════════════════════════════════════════════╗
║        Self-Learning Swarm Demo            ║
╠════════════════════════════════════════════╣${COLORS.reset}
${COLORS.cyan}  1.${COLORS.reset} Query Agent (ask the swarm)
${COLORS.cyan}  2.${COLORS.reset} View Agents (list active agents)
${COLORS.cyan}  3.${COLORS.reset} Run Questions (process generated Q&A)
${COLORS.cyan}  4.${COLORS.reset} View Statistics (swarm metrics)
${COLORS.cyan}  5.${COLORS.reset} Federated Sync (share knowledge)
${COLORS.cyan}  6.${COLORS.reset} Benchmark (performance test)
${COLORS.cyan}  7.${COLORS.reset} Exit
${COLORS.magenta}${COLORS.bold}╚════════════════════════════════════════════╝${COLORS.reset}
`);

        return this.prompt(`${COLORS.yellow}Select option (1-7): ${COLORS.reset}`);
    }

    /**
     * Query the agent swarm
     */
    private async queryAgent(): Promise<void> {
        printSection('Query Agent Swarm');

        const query = await this.prompt(`${COLORS.cyan}Enter your question: ${COLORS.reset}`);
        if (!query.trim()) {
            printWarning('Empty query, returning to menu');
            return;
        }

        console.log(`\n${COLORS.dim}Processing query...${COLORS.reset}`);

        const result = await this.swarm.processQuery(query);

        if (!result) {
            printError('No agent available to process query');
            return;
        }

        this.queriesThisSession++;

        // Display routing info
        console.log(`
${COLORS.bgGreen}${COLORS.bold} AGENT RESPONSE ${COLORS.reset}

${COLORS.cyan}Routed to:${COLORS.reset} ${result.agentId}
${COLORS.dim}Reason: ${result.routing.reason}${COLORS.reset}
${COLORS.dim}Routing confidence: ${formatPercent(result.routing.confidence)}${COLORS.reset}

${COLORS.yellow}State:${COLORS.reset} ${result.result.state.value}
${COLORS.yellow}Action:${COLORS.reset} ${result.result.action}
${COLORS.yellow}Confidence:${COLORS.reset} ${formatPercent(result.result.confidence)}
${COLORS.yellow}Latency:${COLORS.reset} ${formatDuration(result.result.latency)}
${COLORS.yellow}Q-Value:${COLORS.reset} ${result.result.qValue.toFixed(4)}
`);

        // Show reasoning steps if available
        if (result.result.reasoning && result.result.reasoning.length > 0) {
            console.log(`${COLORS.magenta}Reasoning Pipeline:${COLORS.reset}`);
            for (const step of result.result.reasoning) {
                console.log(`  ${COLORS.dim}${step}${COLORS.reset}`);
            }
            console.log();
        }

        // Show response
        console.log(`${COLORS.green}${COLORS.bold}Response:${COLORS.reset}`);
        console.log(`${COLORS.white}${result.result.response}${COLORS.reset}`);

        // Ask for feedback
        const feedback = await this.prompt(`\n${COLORS.yellow}Was this helpful? (y/n): ${COLORS.reset}`);
        if (feedback.toLowerCase() === 'y') {
            const agent = this.swarm.getAgent(result.agentId);
            if (agent) {
                await agent.provideFeedback(true);
                printSuccess('Positive feedback recorded - agent learning reinforced');
            }
        } else if (feedback.toLowerCase() === 'n') {
            const agent = this.swarm.getAgent(result.agentId);
            if (agent) {
                await agent.provideFeedback(false);
                printWarning('Negative feedback recorded - agent will adjust');
            }
        }

        await this.prompt(`\n${COLORS.dim}Press Enter to continue...${COLORS.reset}`);
    }

    /**
     * View all active agents
     */
    private async viewAgents(): Promise<void> {
        printSection('Active Agents');

        const agentIds = this.swarm.getAgentIds();
        console.log(`${COLORS.cyan}Total agents: ${agentIds.length}${COLORS.reset}\n`);

        // Group by domain
        const byDomain: Record<string, Array<{ id: string; name: string; stats: any }>> = {};

        for (const agentId of agentIds) {
            const agent = this.swarm.getAgent(agentId);
            if (!agent) continue;

            const config = agent.getConfig();
            const stats = agent.getStatistics();

            if (!byDomain[config.domain]) {
                byDomain[config.domain] = [];
            }

            byDomain[config.domain].push({
                id: agentId,
                name: config.featureName,
                stats,
            });
        }

        // Display by domain
        for (const [domain, agents] of Object.entries(byDomain).sort()) {
            console.log(`${COLORS.yellow}${COLORS.bold}${domain}${COLORS.reset} (${agents.length} agents)`);

            for (const agent of agents) {
                const stateIcon = agent.stats.currentState.value === 'TEACHING' ? '🎓'
                    : agent.stats.currentState.value === 'CONFIDENT' ? '✓'
                        : agent.stats.currentState.value === 'LEARNING' ? '📚'
                            : '🔍';

                console.log(`  ${stateIcon} ${COLORS.dim}${agent.id}${COLORS.reset}`);
                console.log(`     ${agent.name.substring(0, 40)}`);
                console.log(`     ${COLORS.dim}Queries: ${agent.stats.totalQueries} | Success: ${formatPercent(agent.stats.successfulQueries / Math.max(1, agent.stats.totalQueries))} | State: ${agent.stats.currentState.value}${COLORS.reset}`);
            }
            console.log();
        }

        await this.prompt(`${COLORS.dim}Press Enter to continue...${COLORS.reset}`);
    }

    /**
     * Run generated questions
     */
    private async runQuestions(): Promise<void> {
        if (!this.selection) {
            printError('No document selection loaded');
            return;
        }

        printSection('Run Generated Questions');

        console.log(`${COLORS.cyan}Total questions available: ${this.selection.questions.length}${COLORS.reset}`);

        const countStr = await this.prompt(`How many questions to run (Enter for all): `);
        const maxQuestions = countStr.trim() ? parseInt(countStr, 10) : this.selection.questions.length;

        console.log(`\n${COLORS.yellow}Running ${Math.min(maxQuestions, this.selection.questions.length)} questions...${COLORS.reset}\n`);

        let processed = 0;
        let successful = 0;
        let correctRouting = 0;

        const result = await this.swarm.runAllQuestions({
            maxQuestions,
            progressCallback: (current, total, res) => {
                processed++;
                if (res.result.success) successful++;
                if (res.isCorrectAgent) correctRouting++;

                const pct = Math.round((current / total) * 100);
                const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
                const icon = res.result.success ? '✓' : '✗';
                const color = res.result.success ? COLORS.green : COLORS.red;

                process.stdout.write(`\r${bar} ${pct}% ${color}${icon}${COLORS.reset} Q${current}: ${res.result.action} (${formatDuration(res.result.latency)})`);
            },
        });

        console.log('\n');

        // Display results summary
        console.log(`
${COLORS.bgMagenta}${COLORS.bold} RESULTS SUMMARY ${COLORS.reset}

${COLORS.cyan}Questions Processed:${COLORS.reset} ${result.totalQuestions}
${COLORS.green}Successful Responses:${COLORS.reset} ${result.successfulResponses} (${formatPercent(result.successfulResponses / result.totalQuestions)})
${COLORS.yellow}Correct Routing:${COLORS.reset} ${result.correctRouting} (${formatPercent(result.correctRouting / result.totalQuestions)})
${COLORS.blue}Average Confidence:${COLORS.reset} ${formatPercent(result.averageConfidence)}
${COLORS.magenta}Average Latency:${COLORS.reset} ${formatDuration(result.averageLatency)}
`);

        this.queriesThisSession += result.totalQuestions;

        await this.prompt(`${COLORS.dim}Press Enter to continue...${COLORS.reset}`);
    }

    /**
     * View swarm statistics
     */
    private async viewStatistics(): Promise<void> {
        printSection('Swarm Statistics');

        const stats = this.swarm.getStatistics();
        const sessionDuration = (Date.now() - this.sessionStart) / 1000;

        console.log(`
${COLORS.bgBlue}${COLORS.bold} SWARM OVERVIEW ${COLORS.reset}

${COLORS.cyan}Total Agents:${COLORS.reset}          ${stats.totalAgents}
${COLORS.cyan}Active Agents:${COLORS.reset}         ${stats.activeAgents}
${COLORS.cyan}Total Queries:${COLORS.reset}         ${stats.totalQueries}
${COLORS.cyan}This Session:${COLORS.reset}          ${this.queriesThisSession}
${COLORS.cyan}Session Duration:${COLORS.reset}      ${Math.floor(sessionDuration / 60)}m ${Math.floor(sessionDuration % 60)}s

${COLORS.yellow}${COLORS.bold}Performance Metrics:${COLORS.reset}
${COLORS.yellow}Average Success Rate:${COLORS.reset}  ${formatPercent(stats.averageSuccessRate)}
${COLORS.yellow}Average Response Time:${COLORS.reset} ${formatDuration(stats.averageResponseTime)}
${COLORS.yellow}Learning Progress:${COLORS.reset}     ${formatPercent(stats.learningProgress)}
${COLORS.yellow}Last Federated Sync:${COLORS.reset}   ${stats.lastFederatedSync ? new Date(stats.lastFederatedSync).toLocaleTimeString() : 'Never'}
`);

        // Show top performers
        if (stats.topPerformers.length > 0) {
            console.log(`${COLORS.green}${COLORS.bold}Top Performers:${COLORS.reset}`);
            for (let i = 0; i < Math.min(5, stats.topPerformers.length); i++) {
                const perf = stats.topPerformers[i];
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                console.log(`${medal} ${perf.featureName.substring(0, 30).padEnd(32)} ${formatPercent(perf.successRate).padStart(6)} (${perf.totalQueries} queries)`);
            }
            console.log();
        }

        // Show domain coverage
        if (Object.keys(stats.domainCoverage).length > 0) {
            console.log(`${COLORS.magenta}${COLORS.bold}Domain Coverage:${COLORS.reset}`);
            const maxAgents = Math.max(...Object.values(stats.domainCoverage));
            for (const [domain, count] of Object.entries(stats.domainCoverage).sort((a, b) => b[1] - a[1])) {
                const bar = '█'.repeat(Math.floor((count / maxAgents) * 15)).padEnd(15, '░');
                console.log(`  ${domain.padEnd(25)} ${bar} ${count}`);
            }
            console.log();
        }

        await this.prompt(`${COLORS.dim}Press Enter to continue...${COLORS.reset}`);
    }

    /**
     * Trigger federated sync
     */
    private async federatedSync(): Promise<void> {
        printSection('Federated Knowledge Sync');

        console.log(`${COLORS.yellow}Initiating federated sync across all agents...${COLORS.reset}\n`);

        const result = await this.swarm.federatedSync();

        console.log(`
${COLORS.bgGreen}${COLORS.bold} SYNC COMPLETE ${COLORS.reset}

${COLORS.cyan}Sync ID:${COLORS.reset}             ${result.syncId}
${COLORS.cyan}Agents Participated:${COLORS.reset} ${result.agentsParticipated}
${COLORS.cyan}Knowledge Shared:${COLORS.reset}    ${result.knowledgeShared} patterns
${COLORS.cyan}Conflicts Resolved:${COLORS.reset}  ${result.conflictsResolved}
${COLORS.cyan}Duration:${COLORS.reset}            ${formatDuration(result.duration)}
`);

        printSuccess('All agents have synchronized their knowledge');

        await this.prompt(`${COLORS.dim}Press Enter to continue...${COLORS.reset}`);
    }

    /**
     * Run benchmark
     */
    private async runBenchmark(): Promise<void> {
        printSection('Performance Benchmark');

        const rounds = 10;
        const queriesPerRound = 5;

        console.log(`${COLORS.yellow}Running benchmark: ${rounds} rounds × ${queriesPerRound} queries${COLORS.reset}\n`);

        const testQueries = [
            'How do I configure MIMO Sleep Mode parameters?',
            'What KPIs should I monitor for carrier aggregation?',
            'Troubleshoot handover failures in mobility',
            'When should energy saving features be enabled?',
            'What are the best practices for 5G NR configuration?',
        ];

        const latencies: number[] = [];
        const confidences: number[] = [];

        for (let r = 0; r < rounds; r++) {
            for (let q = 0; q < queriesPerRound; q++) {
                const query = testQueries[q % testQueries.length];
                const result = await this.swarm.processQuery(query);

                if (result) {
                    latencies.push(result.result.latency);
                    confidences.push(result.result.confidence);
                }

                process.stdout.write(`\rProgress: ${r * queriesPerRound + q + 1}/${rounds * queriesPerRound}`);
            }
        }

        console.log('\n');

        // Calculate statistics
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        const throughput = (latencies.length / (latencies.reduce((a, b) => a + b, 0) / 1000));

        console.log(`
${COLORS.bgMagenta}${COLORS.bold} BENCHMARK RESULTS ${COLORS.reset}

${COLORS.cyan}Total Queries:${COLORS.reset}      ${latencies.length}

${COLORS.yellow}${COLORS.bold}Latency Metrics:${COLORS.reset}
${COLORS.yellow}Average:${COLORS.reset}            ${formatDuration(avgLatency)}
${COLORS.yellow}Minimum:${COLORS.reset}            ${formatDuration(minLatency)}
${COLORS.yellow}Maximum:${COLORS.reset}            ${formatDuration(maxLatency)}
${COLORS.yellow}P95:${COLORS.reset}                ${formatDuration(p95Latency)}

${COLORS.green}${COLORS.bold}Performance:${COLORS.reset}
${COLORS.green}Throughput:${COLORS.reset}         ${throughput.toFixed(2)} queries/sec
${COLORS.green}Avg Confidence:${COLORS.reset}     ${formatPercent(avgConfidence)}
`);

        this.queriesThisSession += latencies.length;

        await this.prompt(`${COLORS.dim}Press Enter to continue...${COLORS.reset}`);
    }

    /**
     * Main loop
     */
    async run(): Promise<void> {
        await this.initialize();

        let running = true;

        while (running) {
            const choice = await this.showMainMenu();

            switch (choice.trim()) {
                case '1':
                    await this.queryAgent();
                    break;
                case '2':
                    await this.viewAgents();
                    break;
                case '3':
                    await this.runQuestions();
                    break;
                case '4':
                    await this.viewStatistics();
                    break;
                case '5':
                    await this.federatedSync();
                    break;
                case '6':
                    await this.runBenchmark();
                    break;
                case '7':
                case 'q':
                case 'exit':
                    running = false;
                    break;
                default:
                    printWarning(`Invalid option: ${choice}`);
            }
        }

        await this.shutdown();
    }

    /**
     * Run automated demo (non-interactive)
     */
    async runAutomated(options: CliOptions): Promise<void> {
        await this.initialize();

        printSection('AUTOMATED DEMO MODE');

        // Run questions
        if (this.selection) {
            const maxQ = options.questions > 0 ? options.questions : this.selection.questions.length;

            console.log(`\n${COLORS.yellow}Processing ${maxQ} questions...${COLORS.reset}\n`);

            const result = await this.swarm.runAllQuestions({
                maxQuestions: maxQ,
                progressCallback: (current, total, res) => {
                    if (!options.json) {
                        const icon = res.result.success ? '✓' : '✗';
                        const color = res.result.success ? COLORS.green : COLORS.red;
                        console.log(`${color}${icon}${COLORS.reset} [${current}/${total}] ${res.result.action} - ${formatDuration(res.result.latency)} - ${formatPercent(res.result.confidence)}`);
                    }
                },
            });

            // Perform federated sync
            console.log(`\n${COLORS.yellow}Performing federated sync...${COLORS.reset}`);
            await this.swarm.federatedSync();

            // Get final statistics
            const stats = this.swarm.getStatistics();

            if (options.json) {
                console.log(JSON.stringify({
                    selection: {
                        id: this.selection.selectionId,
                        documents: this.selection.documents.length,
                        questions: this.selection.questions.length,
                    },
                    results: {
                        processed: result.totalQuestions,
                        successful: result.successfulResponses,
                        correctRouting: result.correctRouting,
                        averageConfidence: result.averageConfidence,
                        averageLatency: result.averageLatency,
                    },
                    swarm: stats,
                }, null, 2));
            } else {
                console.log(`
${COLORS.bgGreen}${COLORS.bold} AUTOMATED DEMO COMPLETE ${COLORS.reset}

${COLORS.cyan}Documents Selected:${COLORS.reset}  ${this.selection.documents.length}
${COLORS.cyan}Questions Generated:${COLORS.reset} ${this.selection.questions.length}
${COLORS.cyan}Questions Processed:${COLORS.reset} ${result.totalQuestions}
${COLORS.green}Successful:${COLORS.reset}          ${result.successfulResponses} (${formatPercent(result.successfulResponses / result.totalQuestions)})
${COLORS.yellow}Correct Routing:${COLORS.reset}     ${result.correctRouting} (${formatPercent(result.correctRouting / result.totalQuestions)})
${COLORS.blue}Avg Confidence:${COLORS.reset}      ${formatPercent(result.averageConfidence)}
${COLORS.magenta}Avg Latency:${COLORS.reset}         ${formatDuration(result.averageLatency)}
${COLORS.cyan}Learning Progress:${COLORS.reset}   ${formatPercent(stats.learningProgress)}
`);
            }
        }

        await this.shutdown();
    }

    /**
     * Shutdown
     */
    private async shutdown(): Promise<void> {
        console.log(`\n${COLORS.yellow}Shutting down...${COLORS.reset}`);

        // Persist all states before exit
        const persisted = await this.swarm.persistAllStates();
        printSuccess(`Persisted ${persisted} agent states to AgentDB`);

        await this.swarm.shutdown();
        this.rl.close();

        printSuccess('Self-Learning Demo completed');
        console.log(`${COLORS.dim}Thank you for using the Advanced Multi-Agent Self-Learning Demo${COLORS.reset}\n`);
    }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    const cli = new SelfLearningDemoCLI();

    try {
        if (options.auto) {
            await cli.runAutomated(options);
        } else {
            await cli.run();
        }
    } catch (error) {
        console.error(`${COLORS.red}${COLORS.bold}Error:${COLORS.reset}`, error);
        process.exit(1);
    }
}

main().catch(console.error);
