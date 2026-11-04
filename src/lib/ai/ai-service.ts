import { GoogleGenAI } from '@google/genai';
import { ModelOption, ResponseStyle } from '../../types/chat';
import { buildCompositeSystemInstruction, detectRepeatedQuestion } from './system-instructions';

// ============================================================================
// 1. CENTRALIZED MODEL REGISTRY
// ============================================================================

export interface ModelDefinition extends ModelOption {
  apiModelId: string;
  isAvailable: boolean;
  notes?: string;
}

/**
 * Official verified Google Gemini models for this project.
 * Verified live against Google Gemini Generative Language API.
 */
export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Fast & Stable',
    description: 'High throughput, low latency, balanced intelligence & reliable availability',
    isFree: true,
    isDefault: false,
    apiModelId: 'gemini-3.5-flash',
    isAvailable: true,
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship',
    description: 'Next-gen multimodal reasoning, vision, code synthesis & deep thought',
    isFree: true,
    isDefault: false,
    apiModelId: 'gemini-3.8-flash',
    isAvailable: true,
    notes: 'May experience upstream capacity spikes during peak Google hours',
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Fastest response time, minimal latency, ideal for conversation & quick answers',
    isFree: true,
    isDefault: false,
    apiModelId: 'gemini-3.1-flash-lite',
    isAvailable: true,
  },
};

/**
 * Model aliases for backward compatibility (maps legacy or UI aliases to actual supported IDs)
 */
export const MODEL_ALIASES: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash': 'gemini-3.5-flash',
  'gemini-1.5-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-flash-latest': 'gemini-3.5-flash',
  'gemini-flash-lite-latest': 'gemini-3.1-flash-lite',
  'gemini-4-argon': 'gemini-3.8-flash',
};

/**
 * Auto model definition for the UI
 */
export const AUTO_MODEL_OPTION: ModelOption = {
  id: 'auto',
  name: 'Auto (Smart Router)',
  badge: 'Intelligent',
  description: 'Automatically routes to the best model with instant 503 failover',
  isFree: true,
  isDefault: true,
  isAuto: true,
};

/**
 * List of models surfaced to the frontend UI
 */
export const UI_MODEL_LIST: ModelOption[] = [
  AUTO_MODEL_OPTION,
  MODEL_REGISTRY['gemini-3.5-flash'],
  MODEL_REGISTRY['gemini-3.8-flash'],
  MODEL_REGISTRY['gemini-3.1-flash-lite'],
];

/**
 * Validates whether a model identifier is supported (directly or via alias)
 */
export function isSupportedModel(modelId: string): boolean {
  if (modelId === 'auto') return true;
  if (MODEL_REGISTRY[modelId]) return true;
  if (MODEL_ALIASES[modelId]) return true;
  return false;
}

/**
 * Resolves a model ID to its actual Google Gemini API model ID.
 * Returns null if the model is unknown and unsupported.
 */
export function resolveTargetApiModel(requestedModel: string): string | null {
  if (requestedModel === 'auto') {
    return MODEL_REGISTRY['gemini-3.5-flash'].apiModelId;
  }
  if (MODEL_REGISTRY[requestedModel]) {
    return MODEL_REGISTRY[requestedModel].apiModelId;
  }
  if (MODEL_ALIASES[requestedModel]) {
    const aliased = MODEL_ALIASES[requestedModel];
    return MODEL_REGISTRY[aliased]?.apiModelId || aliased;
  }
  return null;
}

// ============================================================================
// 2. AUTO-ROUTING INTELLIGENCE
// ============================================================================

export type TaskCategory = 'reasoning' | 'vision' | 'fast' | 'general';

export function classifyPromptTask(prompt: string, hasImageAttachment = false): TaskCategory {
  if (hasImageAttachment) return 'vision';
  const lower = prompt.toLowerCase();
  if (
    lower.includes('code') ||
    lower.includes('function') ||
    lower.includes('class') ||
    lower.includes('bug') ||
    lower.includes('algorithm') ||
    lower.includes('refactor') ||
    lower.includes('typescript') ||
    lower.includes('python') ||
    lower.includes('solve') ||
    lower.includes('derive') ||
    lower.includes('proof') ||
    lower.includes('calculate') ||
    lower.includes('architect')
  ) {
    return 'reasoning';
  }
  if (prompt.length < 50 && !lower.includes('explain') && !lower.includes('how')) {
    return 'fast';
  }
  return 'general';
}

/**
 * Intelligently picks a supported model for 'auto' mode.
 */
export function resolveAutoModel(prompt: string, hasImage = false): string {
  const category = classifyPromptTask(prompt, hasImage);
  switch (category) {
    case 'vision':
    case 'reasoning':
      return 'gemini-3.8-flash';
    case 'fast':
    case 'general':
    default:
      return 'gemini-3.5-flash';
  }
}

// ============================================================================
// 3. ERROR CATEGORIZATION & PARSING
// ============================================================================

export interface FormattedAIError {
  message: string;
  statusCode: number;
  category: 'auth' | 'billing' | 'quota' | 'model_not_found' | 'overloaded' | 'invalid_request' | 'internal';
  modelId: string;
  isRetryable: boolean;
  retryAfterSec?: number;
  rawDetails?: string;
}

export function parseAndCategorizeError(err: unknown, modelId: string): FormattedAIError {
  let raw = (err as any)?.message || String(err || '');
  let status = Number((err as any)?.status || (err as any)?.statusCode || 500);

  // Attempt to parse nested JSON error responses from Google RPC
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error?.message) {
      raw = parsed.error.message;
      if (parsed.error.code) status = Number(parsed.error.code);
    }
    // Handle double-nested error strings
    if (typeof raw === 'string' && raw.startsWith('{')) {
      try {
        const nested = JSON.parse(raw);
        if (nested.error?.message) {
          raw = nested.error.message;
          if (nested.error.code) status = Number(nested.error.code);
        }
      } catch { }
    }
  } catch { }

  const lowerRaw = raw.toLowerCase();

  // 1. Authentication / Permission errors (401 / 403)
  if (
    status === 401 ||
    status === 403 ||
    lowerRaw.includes('api_key_invalid') ||
    lowerRaw.includes('api key not valid') ||
    lowerRaw.includes('unauthenticated') ||
    lowerRaw.includes('permission_denied')
  ) {
    return {
      message: 'Authentication failed: Invalid or missing Gemini API key. Please configure GEMINI_API_KEY in your environment variables.',
      statusCode: 401,
      category: 'auth',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 2. Billing / Payment errors (402)
  if (
    status === 402 ||
    lowerRaw.includes('billing') ||
    lowerRaw.includes('payment') ||
    lowerRaw.includes('pay-as-you-go')
  ) {
    return {
      message: 'Gemini API billing error: Payment or billing account issue. Please verify your Google Cloud / AI Studio billing status.',
      statusCode: 402,
      category: 'billing',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 3. Quota / Rate limit errors (429)
  if (
    status === 429 ||
    lowerRaw.includes('resource_exhausted') ||
    lowerRaw.includes('quota') ||
    lowerRaw.includes('rate limit')
  ) {
    return {
      message: `Rate limit or quota exceeded for "${modelId}". Please wait a few seconds before retrying, or switch to Gemini 3.5 Flash.`,
      statusCode: 429,
      category: 'quota',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 4. Model not found / unavailable (404)
  if (
    status === 404 ||
    lowerRaw.includes('not_found') ||
    lowerRaw.includes('not found') ||
    lowerRaw.includes('no longer available') ||
    lowerRaw.includes('does not exist')
  ) {
    return {
      message: `Model "${modelId}" is not available on this API key or API tier. Please select Gemini 3.5 Flash or Gemini 3.1 Flash Lite.`,
      statusCode: 404,
      category: 'model_not_found',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 5. Overloaded / Temporary Service Unavailable (503)
  if (
    status === 503 ||
    lowerRaw.includes('unavailable') ||
    lowerRaw.includes('high demand') ||
    lowerRaw.includes('overloaded')
  ) {
    return {
      message: `The model "${modelId}" is currently experiencing high demand upstream at Google. Please retry in a moment or select Gemini 3.5 Flash.`,
      statusCode: 503,
      category: 'overloaded',
      modelId,
      isRetryable: true,
      rawDetails: raw,
    };
  }

  // 6. Bad Request / Invalid Arguments (400)
  if (status === 400 || lowerRaw.includes('invalid_argument') || lowerRaw.includes('bad request')) {
    return {
      message: `Invalid request sent to AI: ${raw.slice(0, 160)}`,
      statusCode: 400,
      category: 'invalid_request',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 7. Internal / Unclassified (500)
  return {
    message: raw && raw.length < 200 ? raw : `An unexpected error occurred while communicating with model "${modelId}".`,
    statusCode: 500,
    category: 'internal',
    modelId,
    isRetryable: false,
    rawDetails: raw,
  };
}

// ============================================================================
// 4. CLIENT CACHING & CONVERSATION PREPARATION
// ============================================================================

let cachedClient: { key: string; instance: GoogleGenAI } | null = null;

export function getOrCreateGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey || apiKey.length < 8) {
    throw new Error('GEMINI_API_KEY is not configured or too short.');
  }
  if (cachedClient && cachedClient.key === apiKey) {
    return cachedClient.instance;
  }
  const instance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'gemini-studio-pro/2.0',
      },
    },
  });
  cachedClient = { key: apiKey, instance };
  return instance;
}

export interface PreparedChatPayload {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }>;
  config: {
    temperature: number;
    systemInstruction?: string;
    tools?: Array<{ googleSearch: Record<string, never> }>;
  };
}

/**
 * Prunes and prepares the chat payload.
 * Crucial: Only keeps heavy base64 image data on the most recent message that actually has it.
 * This prevents megabytes of image re-upload on every turn, saving bandwidth and preventing timeouts.
 */
export function prepareChatPayload(
  messages: Array<{ role: string; content?: string; image?: { url?: string } }>,
  responseStyle: ResponseStyle = 'balanced',
  customInstruction?: string,
  temperature = 0.7,
  searchGrounding = false
): PreparedChatPayload {
  const recentMessages = messages.slice(-10);

  // Find the index of the last message that carries an image
  let lastImageIdx = -1;
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    if (recentMessages[i].image?.url?.startsWith('data:')) {
      lastImageIdx = i;
      break;
    }
  }

  const contents = recentMessages.map((m, idx) => {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Only attach heavy base64 image on the most recent image-carrying message
    if (idx === lastImageIdx && m.image?.url && m.image.url.startsWith('data:')) {
      const match = m.image.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    if (m.content && m.content.trim()) {
      parts.push({ text: m.content });
    } else if (parts.length === 0) {
      parts.push({ text: ' ' });
    }

    return {
      role: m.role === 'model' || m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts,
    };
  });

  const latestUserPrompt = messages.slice(-1)[0]?.content || '';
  const historyForRepeatCheck = messages.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content || '',
  }));
  const repeatedInfo = detectRepeatedQuestion(latestUserPrompt, historyForRepeatCheck);
  const compositeInstruction = buildCompositeSystemInstruction(
    responseStyle,
    customInstruction,
    repeatedInfo
  );

  const config: PreparedChatPayload['config'] = {
    temperature: Math.max(0, Math.min(1.5, Number(temperature) || 0.7)),
    systemInstruction: compositeInstruction,
  };

  if (searchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  return { contents, config };
}

// ============================================================================
// 5. SHARED CHAT EXECUTION (STREAMING & UNARY)
// ============================================================================

export interface StreamChatExecutionOptions {
  apiKey: string;
  messages: Array<{ role: string; content?: string; image?: { url?: string } }>;
  model: string;
  responseStyle?: ResponseStyle;
  temperature?: number;
  systemInstruction?: string;
  searchGrounding?: boolean;
  requestId?: string;
  onChunk: (delta: string) => void;
  onDone: (telemetry: {
    tokens: number;
    speed: number;
    modelUsed: string;
    durationMs: number;
    ttftMs: number;
  }) => void;
  onError: (error: FormattedAIError) => void;
  isAborted?: () => boolean;
}

/**
 * Shared streaming execution used identically by Express and Vercel serverless.
 */
export async function executeAIChatStream(options: StreamChatExecutionOptions): Promise<void> {
  const {
    apiKey,
    messages,
    model: requestedModel,
    responseStyle = 'balanced',
    temperature = 0.7,
    systemInstruction,
    searchGrounding = false,
    requestId = `req_${Date.now()}`,
    onChunk,
    onDone,
    onError,
    isAborted = () => false,
  } = options;

  const startTime = Date.now();
  let ttftMs = 0;
  let accumulatedText = '';
  let chunkCount = 0;

  // 1. Resolve model
  const isAuto = requestedModel === 'auto';
  let targetModel: string;

  if (isAuto) {
    const latestMsg = messages[messages.length - 1];
    const hasImage = Boolean(latestMsg?.image?.url);
    const promptText = latestMsg?.content || '';
    const autoResolved = resolveAutoModel(promptText, hasImage);
    targetModel = resolveTargetApiModel(autoResolved) || 'gemini-3.5-flash';
  } else {
    const resolved = resolveTargetApiModel(requestedModel);
    if (!resolved) {
      onError({
        message: `Unknown or unsupported model: "${requestedModel}". Supported models: ${UI_MODEL_LIST.filter((m) => !m.isAuto).map((m) => m.name).join(', ')}`,
        statusCode: 400,
        category: 'invalid_request',
        modelId: requestedModel,
        isRetryable: false,
      });
      return;
    }
    // Manual selection: strictly execute the exact selected model. Never silently replace.
    targetModel = resolved;
  }

  // 2. Prepare payload & client
  const client = getOrCreateGeminiClient(apiKey);
  const { contents, config } = prepareChatPayload(
    messages,
    responseStyle,
    systemInstruction,
    temperature,
    searchGrounding
  );

  let activeModel = targetModel;

  // 3. Execution attempt with single-failover for Auto mode only on 503
  const tryStreamOnModel = async (modelToRun: string): Promise<boolean> => {
    const stream = await client.models.generateContentStream({
      model: modelToRun,
      contents,
      config,
    });

    for await (const chunk of stream) {
      if (isAborted()) {
        return false;
      }
      const text = chunk.text;
      if (text) {
        if (!ttftMs) {
          ttftMs = Date.now() - startTime;
        }
        accumulatedText += text;
        chunkCount++;
        onChunk(text);
      }
    }
    return true;
  };

  try {
    try {
      const ok = await tryStreamOnModel(targetModel);
      if (!ok) return; // Client aborted
    } catch (primaryErr: any) {
      // In auto mode only: if error is 503 (high demand) and no tokens were sent yet, try one controlled fallback
      const parsedErr = parseAndCategorizeError(primaryErr, targetModel);

      if (isAuto && parsedErr.category === 'overloaded' && accumulatedText.length === 0 && !isAborted()) {
        const autoFallback = targetModel === 'gemini-3.5-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
        console.warn(`[AI Service] [${requestId}] Auto model ${targetModel} experienced 503 high demand; retrying once on ${autoFallback}`);
        activeModel = autoFallback;
        const ok = await tryStreamOnModel(autoFallback);
        if (!ok) return;
      } else {
        // Manual mode or non-503: throw primary error directly to preserve transparency
        throw primaryErr;
      }
    }

    const durationMs = Date.now() - startTime;
    const estimatedTokens = Math.max(Math.round(accumulatedText.length / 4), chunkCount);
    const speed = Math.round(estimatedTokens / (durationMs / 1000 || 1));

    onDone({
      tokens: estimatedTokens,
      speed,
      modelUsed: activeModel,
      durationMs,
      ttftMs: ttftMs || durationMs,
    });
  } catch (err: unknown) {
    const formatted = parseAndCategorizeError(err, activeModel);
    console.error(`[AI Service Error] [${requestId}] [${activeModel}] [${formatted.category}] [HTTP ${formatted.statusCode}]:`, formatted.message);
    onError(formatted);
  }
}

/**
 * Shared non-streaming execution for batch/unary requests.
 */
export async function executeAIChatUnary(options: {
  apiKey: string;
  messages: Array<{ role: string; content?: string; image?: { url?: string } }>;
  model: string;
  responseStyle?: ResponseStyle;
  temperature?: number;
  systemInstruction?: string;
  searchGrounding?: boolean;
  requestId?: string;
}): Promise<{
  text: string;
  tokens: number;
  speed: number;
  modelUsed: string;
  durationMs: number;
}> {
  const {
    apiKey,
    messages,
    model: requestedModel,
    responseStyle = 'balanced',
    temperature = 0.7,
    systemInstruction,
    searchGrounding = false,
  } = options;

  const startTime = Date.now();
  const isAuto = requestedModel === 'auto';
  let targetModel: string;

  if (isAuto) {
    const latestMsg = messages[messages.length - 1];
    const hasImage = Boolean(latestMsg?.image?.url);
    const promptText = latestMsg?.content || '';
    const autoResolved = resolveAutoModel(promptText, hasImage);
    targetModel = resolveTargetApiModel(autoResolved) || 'gemini-3.5-flash';
  } else {
    const resolved = resolveTargetApiModel(requestedModel);
    if (!resolved) {
      throw new Error(`Unknown model: "${requestedModel}"`);
    }
    targetModel = resolved;
  }

  const client = getOrCreateGeminiClient(apiKey);
  const { contents, config } = prepareChatPayload(
    messages,
    responseStyle,
    systemInstruction,
    temperature,
    searchGrounding
  );

  let activeModel = targetModel;
  let response: any = null;

  try {
    response = await client.models.generateContent({
      model: targetModel,
      contents,
      config,
    });
  } catch (err: any) {
    const parsedErr = parseAndCategorizeError(err, targetModel);
    if (isAuto && parsedErr.category === 'overloaded') {
      const fallback = targetModel === 'gemini-3.5-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
      activeModel = fallback;
      response = await client.models.generateContent({
        model: fallback,
        contents,
        config,
      });
    } else {
      throw err;
    }
  }

  const text = response?.text || '';
  const durationMs = Date.now() - startTime;
  const estimatedTokens = Math.max(Math.round(text.length / 4), 1);
  const speed = Math.round(estimatedTokens / (durationMs / 1000 || 1));

  return {
    text,
    tokens: estimatedTokens,
    speed,
    modelUsed: activeModel,
    durationMs,
  };
}

// ============================================================================
// 6. DEEP HEALTH DIAGNOSTICS
// ============================================================================

export interface HealthDiagnosticReport {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured';
  environment: string;
  isVercel: boolean;
  configured: boolean;
  apiConnectivity: 'connected' | 'unauthenticated' | 'billing_error' | 'disconnected';
  availableModels: string[];
  testedModel: {
    id: string;
    status: 'ok' | 'error';
    latencyMs?: number;
    error?: string;
  };
  timestamp: number;
}

export async function runHealthDiagnostics(apiKey: string): Promise<HealthDiagnosticReport> {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  const configured = Boolean(apiKey && apiKey.length > 8);

  const report: HealthDiagnosticReport = {
    status: 'unconfigured',
    environment,
    isVercel,
    configured,
    apiConnectivity: 'disconnected',
    availableModels: Object.keys(MODEL_REGISTRY),
    testedModel: {
      id: 'gemini-3.5-flash',
      status: 'error',
    },
    timestamp: Date.now(),
  };

  if (!configured) {
    return report;
  }

  const pingStart = Date.now();
  try {
    const client = getOrCreateGeminiClient(apiKey);

    // Live ping test with Gemini 3.5 Flash
    const pingRes = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'ping',
    });

    if (pingRes && pingRes.text !== undefined) {
      report.apiConnectivity = 'connected';
      report.status = 'healthy';
      report.testedModel = {
        id: 'gemini-3.5-flash',
        status: 'ok',
        latencyMs: Date.now() - pingStart,
      };
    }
  } catch (err: any) {
    const parsed = parseAndCategorizeError(err, 'gemini-3.5-flash');
    report.testedModel = {
      id: 'gemini-3.5-flash',
      status: 'error',
      latencyMs: Date.now() - pingStart,
      error: parsed.message,
    };

    if (parsed.category === 'auth') {
      report.apiConnectivity = 'unauthenticated';
      report.status = 'unhealthy';
    } else if (parsed.category === 'billing') {
      report.apiConnectivity = 'billing_error';
      report.status = 'degraded';
    } else if (parsed.category === 'overloaded') {
      report.apiConnectivity = 'connected';
      report.status = 'degraded';
    } else {
      report.apiConnectivity = 'disconnected';
      report.status = 'unhealthy';
    }
  }

  return report;
}
