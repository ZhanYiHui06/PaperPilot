import { ipcMain } from 'electron';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { IPC_CHANNELS } from '../../shared/types';
import type { LLMConfig, LLMTestResult, LLMClassifyEmailResult, ParsedExperimentData } from '../../shared/types';
import { getLLMConfig } from '../../database/db';

const SYSTEM_PROMPTS: Record<string, string> = {
  code: 'You are a helpful assistant that summarizes code changes. Given a git diff or code snippet, provide a concise summary of what changed and why it matters. Respond in Chinese.',
  experiment:
    'You are a helpful assistant that organizes and summarizes experiment data. Given experiment details, provide a clear summary of the setup and results. Do NOT provide optimization suggestions. Respond in Chinese.',
  latex:
    'You are a helpful assistant that summarizes LaTeX document changes. Given the changes, provide a concise summary. Respond in Chinese.',
  email:
    'You are a helpful assistant that classifies and summarizes academic submission emails. Classify the email as one of: review, decision, revision, other. Then provide a brief summary. Respond in Chinese.',
  latex_error:
    'You are a LaTeX compilation expert. Analyze the following LaTeX compilation log and identify the root cause of the compilation failure. Provide a concise explanation covering: 1) What the error is, 2) Where it occurs (file and line number if available), 3) How to fix it. Keep the response under 200 words. Respond in Chinese.',
};

let modelCache: { configKey: string; model: ChatOpenAI } | null = null;

function configKey(c: LLMConfig): string {
  return `${c.provider}|${c.api_key}|${c.model}|${c.base_url}`;
}

function getModel(config: LLMConfig): ChatOpenAI {
  const key = configKey(config);
  if (modelCache && modelCache.configKey === key) {
    return modelCache.model;
  }
  // Ensure base URL has /v1 suffix for DeepSeek compatibility
  let baseURL = config.base_url;
  if (baseURL && !baseURL.endsWith('/v1') && !baseURL.endsWith('/v1/')) {
    // DeepSeek API works with both, but /v1 is more standard
    if (baseURL.includes('deepseek.com') && !baseURL.includes('/v1')) {
      baseURL = baseURL.replace(/\/$/, '') + '/v1';
    }
  }

  const model = new ChatOpenAI({
    apiKey: config.api_key,
    modelName: config.model,
    configuration: {
      baseURL,
    },
  });

  modelCache = { configKey: key, model };
  return model;
}

/**
 * Classify an email's content via LLM.
 * Exported so electron/ipc/email.ts can reuse the same logic for the email fetch pipeline.
 */
export async function classifyEmailViaLLM(content: string): Promise<LLMClassifyEmailResult> {
  const config = getLLMConfig();
  if (!config) throw new Error('LLM config not found');

  const llm = getModel(config);
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are an email classifier. Classify the email as exactly one of: review, decision, revision, other. Also provide a one-sentence summary. Respond in JSON format: {{"type": "...", "summary": "..."}}',
    ],
    ['human', '{content}'],
  ]);
  const chain = prompt.pipe(llm);
  const response = await chain.invoke({ content });
  try {
    const text = response.content as string;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate parsed structure per spec EmailType union
      const VALID_TYPES = ['review', 'decision', 'revision', 'other'] as const;
      const type = VALID_TYPES.includes(parsed.type) ? parsed.type : 'other';
      const summary =
        typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : text;
      return { type, summary };
    }
    return { type: 'other', summary: text };
  } catch {
    return { type: 'other', summary: response.content as string };
  }
}

export function registerLlmIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.LLM_SUMMARIZE,
    async (_e, type: keyof typeof SYSTEM_PROMPTS, content: string): Promise<string> => {
      const config = getLLMConfig();
      if (!config) throw new Error('LLM config not found');

      const llm = getModel(config);
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_PROMPTS[type]],
        ['human', '{content}'],
      ]);
      const chain = prompt.pipe(llm);
      const response = await chain.invoke({ content });
      return response.content as string;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.LLM_CLASSIFY_EMAIL,
    async (_e, content: string): Promise<LLMClassifyEmailResult> => {
      return classifyEmailViaLLM(content);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.LLM_PARSE_EXPERIMENT,
    async (_e, logContent: string): Promise<ParsedExperimentData> => {
      const config = getLLMConfig();
      if (!config) throw new Error('LLM config not found');

      const llm = getModel(config);
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an expert at parsing machine learning experiment logs. Extract structured data from the log text.
Return ONLY valid JSON (no markdown, no explanation) with this exact schema:
{{"dataset": string|null, "metric_names": string[], "methods": [{{"name": string, "values": string[]}}]}}
- "dataset": the dataset name if mentioned, otherwise null.
- "metric_names": the list of evaluation metric names (e.g., ["Accuracy", "F1", "Params"]).
- "methods": each method/model tested, with "name" and "values" aligned to metric_names.
If the log is unparseable, return {{"dataset": null, "metric_names": [], "methods": []}}.`,
        ],
        ['human', '{content}'],
      ]);
      const chain = prompt.pipe(llm);
      const response = await chain.invoke({ content: logContent });
      const text = response.content as string;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            dataset: typeof parsed.dataset === 'string' ? parsed.dataset : null,
            metric_names: Array.isArray(parsed.metric_names) ? parsed.metric_names.map(String) : [],
            methods: Array.isArray(parsed.methods)
              ? parsed.methods.map((m: { name?: string; values?: unknown }) => ({
                  name: String(m.name ?? ''),
                  values: Array.isArray(m.values) ? m.values.map(String) : [],
                }))
              : [],
          };
        }
      } catch {
        // fall through to empty result
      }
      return { dataset: null, metric_names: [], methods: [] };
    },
  );

  ipcMain.handle(IPC_CHANNELS.LLM_TEST_CONNECTION, async (): Promise<LLMTestResult> => {
    const config = getLLMConfig();
    if (!config) {
      return { success: false, message: 'LLM config not found' };
    }
    try {
      const llm = getModel(config);
      const response = await llm.invoke([new HumanMessage('Hello, respond with "API OK"')]);
      return {
        success: true,
        message: response.content as string,
      };
    } catch (e) {
      const error = e as Error;
      return { success: false, message: error.message };
    }
  });
}
