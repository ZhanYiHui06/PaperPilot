/**
 * LLM API Test Script
 * Tests the DeepSeek API connection using LangChain ChatOpenAI.
 *
 * Run with: npx tsx scripts/test-llm.ts
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

const CONFIG = {
  api_key: process.env.DEEPSEEK_API_KEY ?? '',
  model: 'deepseek-chat',
  base_url: 'https://api.deepseek.com/v1',
};

async function testConnection(
  model: string,
  baseURL: string,
  label: string,
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`\n[${label}] Testing model=${model}, baseURL=${baseURL} ...`);
    const llm = new ChatOpenAI({
      apiKey: CONFIG.api_key,
      modelName: model,
      configuration: { baseURL },
    });
    const response = await llm.invoke([new HumanMessage('Hello, respond with "API OK"')]);
    const content = response.content as string;
    console.log(`[${label}] ✓ SUCCESS: ${content}`);
    return { success: true, message: content };
  } catch (e) {
    const error = e as Error;
    console.log(`[${label}] ✗ FAILED: ${error.message}`);
    return { success: false, message: error.message };
  }
}

async function main(): Promise<void> {
  console.log('=== PaperPilot LLM API Test ===');
  if (!CONFIG.api_key) {
    console.log('✗ No API key found. Set the DEEPSEEK_API_KEY environment variable before running.');
    process.exit(1);
  }
  console.log(`API Key: ${CONFIG.api_key.slice(0, 8)}...${CONFIG.api_key.slice(-4)}`);

  const tests = [
    { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1', label: 'deepseek-chat + /v1' },
    { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com', label: 'deepseek-chat (no /v1)' },
    { model: 'deepseek-coder', baseURL: 'https://api.deepseek.com/v1', label: 'deepseek-coder + /v1' },
  ];

  let workingConfig: { model: string; baseURL: string } | null = null;

  for (const test of tests) {
    const result = await testConnection(test.model, test.baseURL, test.label);
    if (result.success) {
      workingConfig = { model: test.model, baseURL: test.baseURL };
      break;
    }
  }

  console.log('\n=== Result ===');
  if (workingConfig) {
    console.log(`✓ WORKING CONFIG: model=${workingConfig.model}, baseURL=${workingConfig.baseURL}`);
    console.log('\nUpdate DECISIONS.md with this working configuration.');
    process.exit(0);
  } else {
    console.log('✗ ALL TESTS FAILED');
    console.log('\nPossible issues:');
    console.log('- Check API key validity');
    console.log('- Check network connection');
    console.log('- Check if DeepSeek API is accessible from your region');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
