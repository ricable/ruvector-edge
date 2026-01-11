import { createProviderManager, LLMRequest } from './claude-flow-v3/v3/@claude-flow/providers/src/index.js';
import { consoleLogger } from './claude-flow-v3/v3/@claude-flow/providers/src/base-provider.js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, './.env') });

const rawKey = process.env.OPENROUTER_API_KEY || '';
const apiKey = rawKey.trim();

console.log('🔍 Key Diagnostics:');
console.log(`   - Prefix: ${apiKey.substring(0, 10)}...`);
console.log(`   - Suffix: ...${apiKey.substring(apiKey.length - 5)}`);
console.log(`   - Length: ${apiKey.length} characters`);
console.log(`   - Raw Length: ${rawKey.length} characters`);
if (rawKey !== apiKey) console.log('   - ⚠️ WARNING: Key had leading/trailing whitespace!');

const TEST_PROMPT = 'Explain the importance of MIMO Sleep Mode in Ericsson RAN optimization.';

async function testRuVectorSONA() {
    console.log('🚀 Initializing RuVector SONA Semantic Router Test...');

    const manager = await createProviderManager({
        providers: [
            {
                provider: 'ruvector',
                model: 'ruvector-auto', // SONA automatic routing
                apiUrl: 'http://localhost:3000',
                providerOptions: {
                    enableSona: true,
                    enableFastGrnn: true,
                    routerStrategy: 'balanced',
                    ollamaUrl: 'http://localhost:11434',
                    localModel: 'qwen2.5-coder:7b', // CPU-friendly fallback
                },
            } as any,
            {
                provider: 'openai',
                apiKey: apiKey, // Use trimmed key
                apiUrl: 'https://openrouter.ai/api/v1',
                model: 'openai/gpt-4o-mini',
                maxTokens: 500,
                providerOptions: {
                    headers: {
                        'HTTP-Referer': 'https://claude-flow.dev',
                        'X-Title': 'Claude Flow V3 SONA Test',
                    },
                },
            } as any
        ],
        loadBalancing: {
            enabled: true,
            strategy: 'cost-based',
        },
        fallback: {
            enabled: true,
            maxAttempts: 2,
        },
    }, consoleLogger);

    console.log('\n📡 Sending semantic query to SONA router...');
    console.log(`Prompt: "${TEST_PROMPT}"`);

    try {
        const startTime = Date.now();
        // Wrap in try-catch to handle provider-specific errors gracefully
        let response;
        try {
            response = await manager.complete({
                messages: [{ role: 'user', content: TEST_PROMPT }],
                requestId: `sona-test-${Date.now()}`,
            });
        } catch (e: any) {
            console.error('\n⚠️ Provider Manager Error (Primary Request Failed):', e.message);
            // Fallback: If managed complete fails, try to use RuVector directly if initialized
            const ruvector = manager.getProvider('ruvector');
            if (ruvector) {
                console.log('\n🔄 Attempting direct RuVector fallback with local model (qwen2.5-coder:7b)...');
                response = await ruvector.complete({
                    messages: [{ role: 'user', content: TEST_PROMPT }],
                    model: 'qwen2.5-coder:7b', // Use specific local model for fallback
                    requestId: `sona-fallback-${Date.now()}`,
                });
            } else {
                throw e;
            }
        }

        const duration = Date.now() - startTime;

        console.log('\n✅ Response Received:');
        console.log('--------------------------------------------------');
        console.log(response.content);
        console.log('--------------------------------------------------');
        console.log(`Provider Used: ${response.provider}`);
        console.log(`Model Selected: ${response.model}`);
        console.log(`Total Latency: ${duration}ms`);

        if (response.metadata?.sona) {
            console.log('\n🧠 SONA Metrics:', JSON.stringify(response.metadata.sona, null, 2));
        }

        if (response.metadata?.router) {
            console.log('\n🗺️ Router Metrics:', JSON.stringify(response.metadata.router, null, 2));
        }

        // Test SONA learning metrics if available
        const ruvectorProvider = manager.getProvider('ruvector') as any;
        if (ruvectorProvider && ruvectorProvider.getSonaMetrics) {
            console.log('\n📊 Fetching Global SONA Metrics...');
            const sonaStats = await ruvectorProvider.getSonaMetrics();
            console.log(JSON.stringify(sonaStats, null, 2));
        }

    } catch (error: any) {
        console.error('\n❌ Test Final Failure:', error.message || error);
        console.log('\n💡 Tip: Make sure RuVector or Ollama is running locally.');
    } finally {
        try {
            await manager.destroy();
        } catch (e) {
            // Ignore destroy errors
        }
    }
}

testRuVectorSONA().catch(console.error);
