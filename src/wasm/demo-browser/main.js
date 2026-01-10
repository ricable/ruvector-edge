/**
 * ELEX Swarm V3 - Multi-Agent Self-Learning Browser Demo
 * 
 * Features:
 * - Multiple specialized RAN AI agents
 * - Q-learning feedback system for self-improvement
 * - Real-time agent performance tracking
 * - Agent collaboration and routing
 * - Federated learning sync visualization
 */

import init, {
    ElexSwarm,
    Topology,
    QueryType,
    Complexity,
    is_simd_available,
    version,
    build_info,
    get_supported_features
} from './elex_wasm.js';

// ============================================================================
// DOM Elements
// ============================================================================

const els = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    queryInput: document.getElementById('queryInput'),
    queryType: document.getElementById('queryType'),
    runBtn: document.getElementById('runBtn'),
    btnText: document.getElementById('btnText'),
    spinner: document.getElementById('spinner'),
    responseArea: document.getElementById('responseArea'),
    versionVal: document.getElementById('versionVal'),
    latencyVal: document.getElementById('latencyVal'),
    agentsVal: document.getElementById('agentsVal'),
    simdVal: document.getElementById('simdVal'),
    successRateVal: document.getElementById('successRateVal'),
    queriesVal: document.getElementById('queriesVal'),
    logArea: document.getElementById('logArea'),
    agentPool: document.getElementById('agentPool'),
    feedbackBtns: document.getElementById('feedbackBtns'),
    syncBtn: document.getElementById('syncBtn'),
    trainBtn: document.getElementById('trainBtn'),
    batchBtn: document.getElementById('batchBtn'),
};

// ============================================================================
// Agent Registry
// ============================================================================

// Specialized RAN AI Agents with Q-learning capabilities
const AGENT_TEMPLATES = [
    { id: 'mimo', name: 'MIMO Expert', feature: 'FAJ 121 3094', specialty: 'MIMO Sleep Mode & Antenna Optimization', color: '#00d4ff' },
    { id: 'iflb', name: 'Load Balancer', feature: 'FAJ 121 3095', specialty: 'Inter-Frequency Load Balancing', color: '#ff6b00' },
    { id: 'prach', name: 'PRACH Optimizer', feature: 'FAJ 121 3096', specialty: 'Random Access Configuration', color: '#00ff88' },
    { id: 'mobility', name: 'Mobility Manager', feature: 'FAJ 121 3097', specialty: 'Handover & Cell Reselection', color: '#ff00ff' },
    { id: 'energy', name: 'Energy Saver', feature: 'FAJ 121 3098', specialty: 'Power Saving & Green RAN', color: '#ffff00' },
    { id: 'qos', name: 'QoS Guardian', feature: 'FAJ 121 3099', specialty: 'Quality of Service Management', color: '#ff4444' },
    { id: 'ca', name: 'CA Specialist', feature: 'FAJ 121 3100', specialty: 'Carrier Aggregation Config', color: '#44ff44' },
    { id: 'troubleshoot', name: 'Troubleshooter', feature: 'FAJ 121 3101', specialty: 'Root Cause Analysis', color: '#ff8844' },
];

// Agent state tracking
const agentState = new Map();
let lastRespondingAgentId = null;
let queryHistory = [];
let totalQueries = 0;
let successfulQueries = 0;

// ============================================================================
// Logging
// ============================================================================

function log(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    const colors = {
        info: '#888',
        success: '#00ff88',
        warning: '#ffaa00',
        error: '#ff4444',
        learning: '#00d4ff',
        agent: '#ff00ff'
    };
    line.style.color = colors[type] || colors.info;
    line.textContent = `[${time}] ${msg}`;
    els.logArea.appendChild(line);
    els.logArea.scrollTop = els.logArea.scrollHeight;

    // Keep log size manageable
    while (els.logArea.children.length > 100) {
        els.logArea.removeChild(els.logArea.firstChild);
    }
}

// ============================================================================
// Swarm Management
// ============================================================================

let swarm = null;

async function initializeSwarm() {
    try {
        log("Initializing WASM module...");
        await init();
        log("WASM module loaded successfully", 'success');

        // Display system info
        const v = version();
        const simd = is_simd_available();
        const features = get_supported_features();

        els.versionVal.textContent = v;
        els.simdVal.textContent = simd ? "ACTIVE" : "INACTIVE";
        els.simdVal.style.color = simd ? "var(--primary)" : "#888";

        log(`System version: ${v}`);
        log(`SIMD acceleration: ${simd ? 'Enabled ✓' : 'Disabled'}`);
        log(`Supported features: ${features.join(', ')}`);

        // Initialize Swarm with multi-agent configuration
        log("Initializing Multi-Agent Swarm...");
        const config = {
            topology: Topology.hierarchical_mesh(),
            maxAgents: 100,
            enableTelemetry: true,
            enableIndexedDB: true,
            lazyLoading: false, // Preload all agents
            cacheSizeMB: 100,
            autoSync: true,
            syncIntervalMs: 30000
        };

        swarm = await new ElexSwarm(config);
        log("Swarm initialized with hierarchical mesh topology", 'success');

        // Initialize agent states
        initializeAgentStates();

        // Update UI
        els.statusDot.classList.add('active');
        els.statusText.textContent = "SWARM ONLINE";
        els.runBtn.disabled = false;
        els.syncBtn.disabled = false;
        els.trainBtn.disabled = false;
        els.batchBtn.disabled = false;

        showWelcomeMessage();
        await updateStats();
        renderAgentPool();

        // Start periodic stats update
        setInterval(updateStats, 5000);

    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`, 'error');
        console.error(err);
        els.statusText.textContent = "SYSTEM ERROR";
        els.statusDot.style.background = "red";
    }
}

function initializeAgentStates() {
    AGENT_TEMPLATES.forEach((template, index) => {
        agentState.set(template.id, {
            ...template,
            queryCount: 0,
            successCount: 0,
            totalReward: 0,
            avgLatency: 0,
            confidence: 0.5,
            epsilon: 0.3, // Exploration rate
            qTableSize: 0,
            learningRate: 0.1,
            status: 'ready',
            lastQuery: null,
            trajectories: [],
        });
    });
    log(`Initialized ${AGENT_TEMPLATES.length} specialized RAN AI agents`, 'agent');
}

// ============================================================================
// Query Processing
// ============================================================================

function getQueryTypeEnum(typeStr) {
    const types = {
        'parameter': QueryType.Parameter,
        'counter': QueryType.Counter,
        'kpi': QueryType.Kpi,
        'procedure': QueryType.Procedure,
        'troubleshoot': QueryType.Troubleshoot,
        'general': QueryType.General
    };
    return types[typeStr] || QueryType.General;
}

function getComplexityFromText(text) {
    const complexWords = ['optimize', 'troubleshoot', 'analyze', 'diagnose', 'root cause', 'complex'];
    const simpleWords = ['check', 'get', 'show', 'list', 'status'];

    const lowerText = text.toLowerCase();
    if (complexWords.some(w => lowerText.includes(w))) return Complexity.Complex;
    if (simpleWords.some(w => lowerText.includes(w))) return Complexity.Simple;
    return Complexity.Moderate;
}

function selectBestAgent(queryText, queryType) {
    // Intelligent agent routing based on query content
    const lowerQuery = queryText.toLowerCase();

    if (lowerQuery.includes('mimo') || lowerQuery.includes('antenna')) return 'mimo';
    if (lowerQuery.includes('load') || lowerQuery.includes('iflb') || lowerQuery.includes('balance')) return 'iflb';
    if (lowerQuery.includes('prach') || lowerQuery.includes('rach') || lowerQuery.includes('access')) return 'prach';
    if (lowerQuery.includes('handover') || lowerQuery.includes('mobility') || lowerQuery.includes('reselection')) return 'mobility';
    if (lowerQuery.includes('energy') || lowerQuery.includes('power') || lowerQuery.includes('sleep')) return 'energy';
    if (lowerQuery.includes('qos') || lowerQuery.includes('quality') || lowerQuery.includes('priority')) return 'qos';
    if (lowerQuery.includes('carrier') || lowerQuery.includes('aggregation') || lowerQuery.includes('ca')) return 'ca';
    if (lowerQuery.includes('troubleshoot') || lowerQuery.includes('diagnose') || lowerQuery.includes('root cause')) return 'troubleshoot';

    // Q-learning based selection: choose agent with best confidence * (1 - epsilon) + random exploration
    let bestAgent = AGENT_TEMPLATES[0].id;
    let bestScore = -Infinity;

    AGENT_TEMPLATES.forEach(template => {
        const state = agentState.get(template.id);
        const explorationBonus = Math.random() * state.epsilon;
        const score = state.confidence * (1 - state.epsilon) + explorationBonus;
        if (score > bestScore) {
            bestScore = score;
            bestAgent = template.id;
        }
    });

    return bestAgent;
}

async function handleQuery() {
    const text = els.queryInput.value.trim();
    if (!text || !swarm) return;

    els.runBtn.disabled = true;
    els.spinner.style.display = 'inline-block';
    els.btnText.textContent = 'AGENTS COLLABORATING...';

    const queryTypeStr = els.queryType?.value || 'general';
    const selectedAgentId = selectBestAgent(text, queryTypeStr);
    const agentInfo = agentState.get(selectedAgentId);

    log(`Query routed to ${agentInfo.name} (${agentInfo.specialty})`, 'agent');
    updateAgentStatus(selectedAgentId, 'processing');

    try {
        const start = performance.now();
        const response = await swarm.query({
            text: text,
            queryType: getQueryTypeEnum(queryTypeStr),
            complexity: getComplexityFromText(text)
        });
        const duration = performance.now() - start;

        // Update agent state with learning
        updateAgentLearning(selectedAgentId, duration, response.confidence, true);
        lastRespondingAgentId = response.agentId;
        totalQueries++;

        // Store query for batch learning
        queryHistory.push({
            text,
            agentId: selectedAgentId,
            wasmAgentId: response.agentId,
            response: response.text,
            confidence: response.confidence,
            latency: duration,
            timestamp: Date.now()
        });

        renderQueryResponse(response, duration, agentInfo);
        log(`Response generated in ${duration.toFixed(1)}ms with ${(response.confidence * 100).toFixed(0)}% confidence`, 'success');

        // Show feedback buttons
        els.feedbackBtns.style.display = 'flex';

        await updateStats();
        renderAgentPool();

    } catch (err) {
        log(`Query error: ${err.message}`, 'error');
        updateAgentLearning(selectedAgentId, 0, 0, false);
        els.responseArea.innerHTML = `<div style="color: red;">Error: ${err.message}</div>`;
    } finally {
        els.runBtn.disabled = false;
        els.spinner.style.display = 'none';
        els.btnText.textContent = 'EXECUTE QUERY';
        updateAgentStatus(selectedAgentId, 'ready');
    }
}

function renderQueryResponse(response, duration, agentInfo) {
    const confidenceColor = response.confidence > 0.7 ? '#00ff88' :
        response.confidence > 0.4 ? '#ffaa00' : '#ff4444';

    els.responseArea.innerHTML = `
        <div class="response-header">
            <div class="agent-badge" style="background: ${agentInfo.color}20; border-color: ${agentInfo.color};">
                <span class="agent-icon">🤖</span>
                <span>${agentInfo.name}</span>
            </div>
            <div class="response-meta">
                <span class="response-label">Feature</span>
                <span style="color: var(--primary);">${response.featureCode}</span>
            </div>
        </div>
        
        <div class="response-stats">
            <div class="stat-chip">
                <span class="stat-icon">⏱️</span>
                <span>${duration.toFixed(2)}ms</span>
            </div>
            <div class="stat-chip">
                <span class="stat-icon">🎯</span>
                <span style="color: ${confidenceColor}">${(response.confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="stat-chip">
                <span class="stat-icon">🧠</span>
                <span>Q-Learning Active</span>
            </div>
        </div>

        <div class="response-text">
            ${response.text}
        </div>
        
        <div class="response-footer">
            Agent ID: ${response.agentId.substring(0, 24)}... | WASM Local Runtime
        </div>
    `;
}

// ============================================================================
// Q-Learning & Feedback System
// ============================================================================

function updateAgentLearning(agentId, latency, confidence, success) {
    const state = agentState.get(agentId);
    if (!state) return;

    state.queryCount++;
    if (success) state.successCount++;

    // Update running averages
    const alpha = state.learningRate;
    state.avgLatency = state.avgLatency * (1 - alpha) + latency * alpha;
    state.confidence = state.confidence * (1 - alpha) + confidence * alpha;

    // Decay epsilon (reduce exploration over time)
    state.epsilon = Math.max(0.05, state.epsilon * 0.99);

    state.lastQuery = Date.now();
    agentState.set(agentId, state);
}

async function provideFeedback(reward) {
    if (!lastRespondingAgentId || !swarm) return;

    const success = reward > 0;
    const feedbackType = reward > 0.5 ? 'positive' : reward > 0 ? 'neutral' : 'negative';

    try {
        await swarm.feedback(lastRespondingAgentId, reward, success);
        log(`Feedback recorded: ${feedbackType} (reward: ${reward.toFixed(1)})`, 'learning');

        // Update local agent tracking
        if (queryHistory.length > 0) {
            const lastQuery = queryHistory[queryHistory.length - 1];
            const state = agentState.get(lastQuery.agentId);
            if (state) {
                state.totalReward += reward;
                if (success) successfulQueries++;
                agentState.set(lastQuery.agentId, state);
            }
        }

        renderAgentPool();
        await updateStats();

        // Hide feedback buttons after use
        els.feedbackBtns.style.display = 'none';

    } catch (err) {
        log(`Feedback error: ${err.message}`, 'error');
    }
}

async function triggerFederatedSync() {
    if (!swarm) return;

    els.syncBtn.disabled = true;
    els.syncBtn.textContent = 'SYNCING...';
    log('Initiating federated learning sync...', 'learning');

    try {
        const start = performance.now();
        await swarm.sync();
        const duration = performance.now() - start;

        log(`Federated sync completed in ${duration.toFixed(1)}ms`, 'success');
        log('Q-tables synchronized across agent swarm', 'learning');

        // Visual feedback
        document.querySelectorAll('.agent-card').forEach(card => {
            card.classList.add('syncing');
            setTimeout(() => card.classList.remove('syncing'), 1000);
        });

    } catch (err) {
        log(`Sync error: ${err.message}`, 'error');
    } finally {
        els.syncBtn.disabled = false;
        els.syncBtn.textContent = '🔄 SYNC';
    }
}

async function triggerBatchTraining() {
    if (!swarm || queryHistory.length === 0) {
        log('No query history for batch training', 'warning');
        return;
    }

    els.trainBtn.disabled = true;
    els.trainBtn.textContent = 'TRAINING...';
    log(`Starting batch training on ${queryHistory.length} trajectories...`, 'learning');

    try {
        // Simulate batch training with varied feedback
        for (let i = 0; i < Math.min(queryHistory.length, 10); i++) {
            const query = queryHistory[i];
            const syntheticReward = query.confidence > 0.6 ? 0.8 : 0.2;
            await swarm.feedback(query.wasmAgentId, syntheticReward, syntheticReward > 0.5);

            // Update agent learning
            const state = agentState.get(query.agentId);
            if (state) {
                state.qTableSize++;
                state.trajectories.push({ reward: syntheticReward, timestamp: Date.now() });
                agentState.set(query.agentId, state);
            }
        }

        log(`Batch training completed: ${Math.min(queryHistory.length, 10)} trajectories processed`, 'success');
        renderAgentPool();

    } catch (err) {
        log(`Training error: ${err.message}`, 'error');
    } finally {
        els.trainBtn.disabled = false;
        els.trainBtn.textContent = '🎓 TRAIN';
    }
}

async function runBatchQueries() {
    if (!swarm) return;

    els.batchBtn.disabled = true;
    els.batchBtn.textContent = 'RUNNING...';

    const batchQueries = [
        'Optimize MIMO antenna configuration',
        'Balance load across frequencies',
        'Configure PRACH for dense urban',
        'Troubleshoot handover failures',
        'Reduce energy consumption',
        'Improve QoS for VoLTE',
        'Enable carrier aggregation',
        'Diagnose RACH congestion'
    ];

    log(`Running batch of ${batchQueries.length} queries for multi-agent learning...`, 'learning');

    for (const query of batchQueries) {
        els.queryInput.value = query;
        await handleQuery();
        await new Promise(r => setTimeout(r, 500)); // Small delay between queries

        // Auto-provide positive feedback for demo
        if (lastRespondingAgentId) {
            await swarm.feedback(lastRespondingAgentId, 0.8, true);
        }
    }

    log('Batch query execution completed', 'success');
    els.batchBtn.disabled = false;
    els.batchBtn.textContent = '⚡ BATCH';
}

// ============================================================================
// UI Updates
// ============================================================================

function updateAgentStatus(agentId, status) {
    const state = agentState.get(agentId);
    if (state) {
        state.status = status;
        agentState.set(agentId, state);
        renderAgentPool();
    }
}

async function updateStats() {
    if (!swarm) return;

    try {
        const stats = await swarm.get_swarm_stats();
        els.agentsVal.textContent = AGENT_TEMPLATES.length;
        els.latencyVal.textContent = `${stats.avgLatencyMs.toFixed(1)}ms`;

        // Calculate success rate
        const successRate = totalQueries > 0 ? (successfulQueries / totalQueries * 100) : 0;
        if (els.successRateVal) els.successRateVal.textContent = `${successRate.toFixed(0)}%`;
        if (els.queriesVal) els.queriesVal.textContent = totalQueries;

    } catch (err) {
        console.error('Stats update error:', err);
    }
}

function renderAgentPool() {
    if (!els.agentPool) return;

    els.agentPool.innerHTML = '';

    agentState.forEach((state, id) => {
        const successRate = state.queryCount > 0
            ? ((state.successCount / state.queryCount) * 100).toFixed(0)
            : '0';

        const card = document.createElement('div');
        card.className = `agent-card ${state.status}`;
        card.style.borderColor = state.color;

        const confidenceBar = Math.min(100, state.confidence * 100);
        const explorationBar = state.epsilon * 100;

        card.innerHTML = `
            <div class="agent-header">
                <div class="agent-id" style="color: ${state.color}">${state.name}</div>
                <div class="agent-status ${state.status}">${state.status.toUpperCase()}</div>
            </div>
            <div class="agent-feature">${state.specialty}</div>
            <div class="agent-stats">
                <div class="agent-stat">
                    <span class="stat-label">Queries</span>
                    <span class="stat-val">${state.queryCount}</span>
                </div>
                <div class="agent-stat">
                    <span class="stat-label">Success</span>
                    <span class="stat-val">${successRate}%</span>
                </div>
                <div class="agent-stat">
                    <span class="stat-label">Latency</span>
                    <span class="stat-val">${state.avgLatency.toFixed(1)}ms</span>
                </div>
            </div>
            <div class="learning-bars">
                <div class="bar-container">
                    <div class="bar-label">Confidence</div>
                    <div class="bar-track">
                        <div class="bar-fill confidence" style="width: ${confidenceBar}%"></div>
                    </div>
                </div>
                <div class="bar-container">
                    <div class="bar-label">Exploration (ε)</div>
                    <div class="bar-track">
                        <div class="bar-fill exploration" style="width: ${explorationBar}%"></div>
                    </div>
                </div>
            </div>
            <div class="q-learning-badge">
                🧠 Q-Table: ${state.qTableSize} entries | α=${state.learningRate}
            </div>
        `;

        els.agentPool.appendChild(card);
    });
}

function showWelcomeMessage() {
    els.responseArea.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🤖</div>
            <h3>Multi-Agent Swarm Ready</h3>
            <p>${AGENT_TEMPLATES.length} specialized RAN AI agents initialized with Q-learning capabilities.</p>
            <div class="feature-list">
                <div class="feature-item">✓ Self-learning via Q-tables</div>
                <div class="feature-item">✓ Intelligent query routing</div>
                <div class="feature-item">✓ Federated learning sync</div>
                <div class="feature-item">✓ Real-time feedback loop</div>
            </div>
            <p class="hint">Try: "Optimize MIMO sleep mode" or "Troubleshoot handover failures"</p>
        </div>
    `;
}

// ============================================================================
// Event Listeners
// ============================================================================

els.runBtn.addEventListener('click', handleQuery);
els.queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleQuery();
    }
});

// Feedback buttons
document.getElementById('feedbackGood')?.addEventListener('click', () => provideFeedback(1.0));
document.getElementById('feedbackNeutral')?.addEventListener('click', () => provideFeedback(0.0));
document.getElementById('feedbackBad')?.addEventListener('click', () => provideFeedback(-1.0));

// Control buttons
els.syncBtn?.addEventListener('click', triggerFederatedSync);
els.trainBtn?.addEventListener('click', triggerBatchTraining);
els.batchBtn?.addEventListener('click', runBatchQueries);

// ============================================================================
// Initialize
// ============================================================================

initializeSwarm();
