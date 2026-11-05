import { GoogleGenAI } from '@google/genai';
import { ModelOption, ResponseStyle } from '../../types/chat';
import { buildCompositeSystemInstruction, detectRepeatedQuestion } from './system-instructions';

// ============================================================================
// 1. CENTRALIZED MODEL REGISTRY & BACKWARD COMPATIBILITY
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
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'Ultra Fast & Free',
    description: 'Ultra-low latency, highly resilient free-tier model optimal for continuous multi-turn conversations',
    isFree: true,
    isDefault: false,
    apiModelId: 'gemini-3.5-flash-lite',
    isAvailable: true,
  },
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Fast & Balanced',
    description: 'High throughput, balanced intelligence & multimodal reasoning',
    isFree: true,
    isDefault: false,
    apiModelId: 'gemini-3.5-flash',
    isAvailable: true,
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship Reasoning',
    description: 'Next-gen multimodal reasoning, vision, code synthesis & deep thought',
    isFree: true,
    isDefault: false,
    apiModelId: 'gemini-3.8-flash',
    isAvailable: true,
    notes: 'May experience upstream capacity spikes during peak Google hours',
  },
};

/**
 * Model aliases for backward compatibility (maps legacy or UI aliases to actual supported IDs)
 */
export const MODEL_ALIASES: Record<string, string> = {
  'gemini-3.1-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-flash-latest': 'gemini-3.5-flash',
  'gemini-flash-lite-latest': 'gemini-3.5-flash-lite',
  'gemini-4-argon': 'gemini-3.8-flash',
};

/**
 * Auto model definition for the UI
 */
export const AUTO_MODEL_OPTION: ModelOption = {
  id: 'auto',
  name: 'Auto (Smart Router)',
  badge: 'Intelligent',
  description: 'Automatically routes to the best model with instant free-tier failover',
  isFree: true,
  isDefault: true,
  isAuto: true,
};

/**
 * List of models surfaced to the frontend UI
 */
export const UI_MODEL_LIST: ModelOption[] = [
  AUTO_MODEL_OPTION,
  MODEL_REGISTRY['gemini-3.5-flash-lite'],
  MODEL_REGISTRY['gemini-3.5-flash'],
  MODEL_REGISTRY['gemini-3.8-flash'],
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
    return MODEL_REGISTRY['gemini-3.5-flash-lite'].apiModelId;
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
      return 'gemini-3.5-flash';
    case 'fast':
    case 'general':
    default:
      return 'gemini-3.5-flash-lite';
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

/**
 * Parses, sanitizes, and categorizes errors returned by Google GenAI.
 * CRITICAL: Quota/Rate Limit (429) is evaluated BEFORE any generic "billing" keyword check,
 * because Google's 429 error messages frequently include the sentence:
 * "You exceeded your current quota, please check your plan and billing details."
 */
export function parseAndCategorizeError(err: unknown, modelId: string): FormattedAIError {
  let raw = (err as any)?.message || String(err || '');
  let status = Number((err as any)?.status || (err as any)?.statusCode || (err as any)?.code || 500);
  let rpcStatus = '';
  let retryDelaySec: number | undefined;
  let isDailyQuotaExhausted = false;

  // Extract nested JSON error payload if present
  try {
    let parsed: any = null;
    if (typeof raw === 'string' && (raw.startsWith('{') || raw.includes('{"error"'))) {
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      }
    } else if ((err as any)?.error) {
      parsed = err;
    }

    if (parsed?.error) {
      if (parsed.error.code) status = Number(parsed.error.code);
      if (parsed.error.status) rpcStatus = String(parsed.error.status);
      if (parsed.error.message) raw = parsed.error.message;

      if (Array.isArray(parsed.error.details)) {
        for (const detail of parsed.error.details) {
          if (detail['@type']?.includes('RetryInfo') && detail.retryDelay) {
            const match = String(detail.retryDelay).match(/^(\d+)/);
            if (match) retryDelaySec = parseInt(match[1], 10);
          }
          if (detail['@type']?.includes('QuotaFailure')) {
            const desc = JSON.stringify(detail).toLowerCase();
            if (desc.includes('per day') || desc.includes('daily')) {
              isDailyQuotaExhausted = true;
            }
          }
        }
      }
    }
  } catch {
    // If JSON parsing fails, retain raw string
  }

  const lowerRaw = raw.toLowerCase();

  // 1. Authentication / Permission errors (401 / 403)
  if (
    status === 401 ||
    status === 403 ||
    rpcStatus === 'UNAUTHENTICATED' ||
    rpcStatus === 'PERMISSION_DENIED' ||
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

  // 2. Quota / Rate limit errors (429 / RESOURCE_EXHAUSTED)
  // MUST be checked before billing check to prevent false 402 billing errors!
  if (
    status === 429 ||
    rpcStatus === 'RESOURCE_EXHAUSTED' ||
    lowerRaw.includes('resource_exhausted') ||
    lowerRaw.includes('quota exceeded') ||
    lowerRaw.includes('exceeded your current quota') ||
    lowerRaw.includes('rate limit') ||
    lowerRaw.includes('too many requests')
  ) {
    if (isDailyQuotaExhausted || lowerRaw.includes('per day limit exceeded') || (retryDelaySec && retryDelaySec > 60)) {
      return {
        message: `Daily Free Tier request quota for "${modelId}" has been reached. Please switch to Gemini 3.5 Flash Lite or wait for your daily quota to reset.`,
        statusCode: 429,
        category: 'quota',
        modelId,
        isRetryable: false,
        retryAfterSec: retryDelaySec,
        rawDetails: raw,
      };
    }

    return {
      message: `Temporary rate limit reached for "${modelId}". Waiting for cooldown...`,
      statusCode: 429,
      category: 'quota',
      modelId,
      isRetryable: true,
      retryAfterSec: retryDelaySec || 3,
      rawDetails: raw,
    };
  }

  // 3. Temporary Overloaded / High Demand / Service Unavailable (503 / 502 / 504 / UNAVAILABLE)
  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    rpcStatus === 'UNAVAILABLE' ||
    rpcStatus === 'DEADLINE_EXCEEDED' ||
    lowerRaw.includes('unavailable') ||
    lowerRaw.includes('high demand') ||
    lowerRaw.includes('overloaded') ||
    lowerRaw.includes('temporarily unavailable')
  ) {
    return {
      message: `Model "${modelId}" is currently experiencing high demand upstream at Google. Retrying or switching to an active model...`,
      statusCode: 503,
      category: 'overloaded',
      modelId,
      isRetryable: true,
      retryAfterSec: 2,
      rawDetails: raw,
    };
  }

  // 4. Model not found / unavailable (404 / NOT_FOUND)
  if (
    status === 404 ||
    rpcStatus === 'NOT_FOUND' ||
    lowerRaw.includes('not_found') ||
    lowerRaw.includes('not found') ||
    lowerRaw.includes('no longer available') ||
    lowerRaw.includes('does not exist')
  ) {
    return {
      message: `Model "${modelId}" is no longer available at Google API. Please select Gemini 3.5 Flash Lite or Gemini 3.5 Flash.`,
      statusCode: 404,
      category: 'model_not_found',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 5. Bad Request / Invalid Arguments (400 / INVALID_ARGUMENT)
  if (
    status === 400 ||
    rpcStatus === 'INVALID_ARGUMENT' ||
    lowerRaw.includes('invalid_argument') ||
    lowerRaw.includes('bad request')
  ) {
    return {
      message: `Invalid request payload sent to Gemini API: ${raw.slice(0, 160)}`,
      statusCode: 400,
      category: 'invalid_request',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 6. Genuine Billing / Payment Account Disabled (402 / PAYMENT_REQUIRED)
  // Strictly applies ONLY when status is explicitly 402 or billing account is disabled
  if (
    status === 402 ||
    rpcStatus === 'PAYMENT_REQUIRED' ||
    lowerRaw.includes('billing account is disabled') ||
    lowerRaw.includes('billing account has been closed')
  ) {
    return {
      message: 'Google Cloud billing error: Your Google Cloud billing account is disabled or requires verification in Google Cloud Console.',
      statusCode: 402,
      category: 'billing',
      modelId,
      isRetryable: false,
      rawDetails: raw,
    };
  }

  // 7. Internal / Unclassified (500)
  return {
    message: raw && raw.length < 200 ? raw : `An unexpected upstream error occurred while communicating with model "${modelId}".`,
    statusCode: 500,
    category: 'internal',
    modelId,
    isRetryable: false,
    rawDetails: raw,
  };
}

// ============================================================================
// 4. MULTI-TURN CONVERSATION HISTORY MANAGEMENT & SANITIZATION
// ============================================================================

export interface RawChatMessage {
  role: string;
  content?: string;
  image?: { url?: string; mimeType?: string; name?: string };
  status?: string;
}

export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContentItem {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

/**
 * Robustly sanitizes and formats conversation history for Google Gemini API:
 * 1. Excludes messages with status === 'error' or empty placeholder messages.
 * 2. Normalizes roles to 'user' | 'model'.
 * 3. Enforces strict alternation (merges consecutive user or model turns).
 * 4. Guarantees history starts with role 'user' and ends with role 'user'.
 * 5. Strips heavy base64 images from historical turns (keeping base64 ONLY on the latest
 *    image-bearing message) to prevent payload bloat and Vercel 4.5MB request limits.
 * 6. Safely slides context window (default up to 40 turns) without breaking user-start.
 */
export function sanitizeAndPrepareConversationHistory(
  messages: RawChatMessage[],
  maxTurns = 40
): GeminiContentItem[] {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // 1. Filter out error messages, empty placeholder messages, or uninitialized turns
  const validMessages = messages.filter((m) => {
    if (!m) return false;
    if (m.status === 'error') return false;
    const hasText = Boolean(m.content && m.content.trim().length > 0);
    const hasImage = Boolean(m.image?.url && m.image.url.trim().length > 0);
    return hasText || hasImage;
  });

  if (validMessages.length === 0) {
    return [];
  }

  // 2. Find the index of the most recent message with a base64 data image
  let latestImageIndex = -1;
  for (let i = validMessages.length - 1; i >= 0; i--) {
    if (validMessages[i].image?.url?.startsWith('data:')) {
      latestImageIndex = i;
      break;
    }
  }

  // 3. Convert to GeminiContentItem objects
  const rawContents: GeminiContentItem[] = [];

  for (let i = 0; i < validMessages.length; i++) {
    const m = validMessages[i];
    const role: 'user' | 'model' =
      m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiContentPart[] = [];

    // Only attach full base64 image data to the most recent image message
    if (i === latestImageIndex && m.image?.url?.startsWith('data:')) {
      const match = m.image.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    } else if (m.image?.name) {
      // For older turns, use a lightweight text reference
      parts.push({ text: `[Attached image: ${m.image.name}]` });
    }

    if (m.content && m.content.trim().length > 0) {
      parts.push({ text: m.content.trim() });
    }

    if (parts.length > 0) {
      rawContents.push({ role, parts });
    }
  }

  if (rawContents.length === 0) {
    return [];
  }

  // 4. Merge consecutive messages with the same role to enforce strict alternation
  const alternatingContents: GeminiContentItem[] = [];

  for (const item of rawContents) {
    if (alternatingContents.length === 0) {
      alternatingContents.push({ role: item.role, parts: [...item.parts] });
    } else {
      const prev = alternatingContents[alternatingContents.length - 1];
      if (prev.role === item.role) {
        // Merge into previous turn with same role
        prev.parts.push(...item.parts);
      } else {
        alternatingContents.push({ role: item.role, parts: [...item.parts] });
      }
    }
  }

  // 5. Ensure the history starts with role: 'user'
  while (alternatingContents.length > 0 && alternatingContents[0].role !== 'user') {
    alternatingContents.shift();
  }

  if (alternatingContents.length === 0) {
    return [];
  }

  // 6. Ensure the history ends with role: 'user'
  while (alternatingContents.length > 0 && alternatingContents[alternatingContents.length - 1].role !== 'user') {
    alternatingContents.pop();
  }

  if (alternatingContents.length === 0) {
    return [];
  }

  // 7. Apply maxTurns limit safely (preserving user-start)
  const maxContents = Math.max(1, maxTurns * 2 - 1);
  if (alternatingContents.length > maxContents) {
    let sliced = alternatingContents.slice(-maxContents);
    while (sliced.length > 0 && sliced[0].role !== 'user') {
      sliced.shift();
    }
    return sliced;
  }

  return alternatingContents;
}

// ============================================================================
// 5. CLIENT CACHING & CONVERSATION PREPARATION
// ============================================================================

let cachedClient: { key: string; instance: GoogleGenAI } | null = null;

export function getOrCreateGeminiClient(apiKey: string): GoogleGenAI {
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
  contents: GeminiContentItem[];
  config: {
    temperature: number;
    systemInstruction: string;
    tools?: Array<{ googleSearch: {} }>;
  };
}

export function prepareChatPayload(
  messages: RawChatMessage[],
  responseStyle: ResponseStyle = 'balanced',
  customInstruction?: string,
  temperature = 0.7,
  searchGrounding = false
): PreparedChatPayload {
  const contents = sanitizeAndPrepareConversationHistory(messages, 40);

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
// 6. SHARED CHAT EXECUTION (STREAMING & UNARY WITH RETRY & FAILOVER)
// ============================================================================

export interface StreamChatExecutionOptions {
  apiKey: string;
  messages: RawChatMessage[];
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
    targetModel = resolveTargetApiModel(autoResolved) || 'gemini-3.5-flash-lite';
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

  if (contents.length === 0) {
    onError({
      message: 'No valid message content to send to Gemini API.',
      statusCode: 400,
      category: 'invalid_request',
      modelId: targetModel,
      isRetryable: false,
    });
    return;
  }

  let activeModel = targetModel;

  // 3. Execution attempt with exponential backoff retry for transient errors
  const attemptStreamWithRetry = async (
    modelToRun: string,
    maxRetries = 2
  ): Promise<{ ok: boolean; lastError?: any }> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (isAborted()) return { ok: false };
      try {
        const stream = await client.models.generateContentStream({
          model: modelToRun,
          contents,
          config,
        });

        for await (const chunk of stream) {
          if (isAborted()) return { ok: false };
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
        return { ok: true };
      } catch (err: any) {
        if (accumulatedText.length > 0) {
          // Tokens were already delivered; cannot transparently retry from stream start
          throw err;
        }
        const parsed = parseAndCategorizeError(err, modelToRun);
        if (parsed.isRetryable && attempt < maxRetries && !isAborted()) {
          const delayMs = Math.min(
            4000,
            Math.round(
              (parsed.retryAfterSec ? parsed.retryAfterSec * 1000 : 1000) * Math.pow(1.5, attempt) +
                Math.random() * 400
            )
          );
          console.warn(
            `[AI Service] [${requestId}] [${modelToRun}] Transient ${parsed.category} (HTTP ${parsed.statusCode}). Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return { ok: false, lastError: err };
      }
    }
    return { ok: false };
  };

  try {
    let result = await attemptStreamWithRetry(targetModel, 2);

    if (!result.ok && result.lastError && accumulatedText.length === 0 && !isAborted()) {
      const parsedErr = parseAndCategorizeError(result.lastError, targetModel);

      // In Auto Mode: if the target model failed due to 503 high demand or 429 quota exhaustion,
      // perform controlled fallback to our free-tier workhorse
      if (isAuto && (parsedErr.category === 'overloaded' || parsedErr.category === 'quota')) {
        const fallbackModel =
          targetModel === 'gemini-3.5-flash-lite' ? 'gemini-3.5-flash' : 'gemini-3.5-flash-lite';
        console.warn(
          `[AI Service] [${requestId}] Auto mode failover from ${targetModel} to ${fallbackModel} due to ${parsedErr.category}`
        );
        activeModel = fallbackModel;
        result = await attemptStreamWithRetry(fallbackModel, 1);
        if (!result.ok && result.lastError) {
          throw result.lastError;
        }
      } else {
        throw result.lastError;
      }
    }

    if (isAborted()) return;

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
    console.error(
      `[AI Service Error] [${requestId}] [${activeModel}] [${formatted.category}] [HTTP ${formatted.statusCode}]:`,
      formatted.message
    );
    onError(formatted);
  }
}

/**
 * Shared non-streaming execution for batch/unary requests.
 */
export async function executeAIChatUnary(options: {
  apiKey: string;
  messages: RawChatMessage[];
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
    requestId = `unary_${Date.now()}`,
  } = options;

  const startTime = Date.now();
  const isAuto = requestedModel === 'auto';
  let targetModel: string;

  if (isAuto) {
    const latestMsg = messages[messages.length - 1];
    const hasImage = Boolean(latestMsg?.image?.url);
    const promptText = latestMsg?.content || '';
    const autoResolved = resolveAutoModel(promptText, hasImage);
    targetModel = resolveTargetApiModel(autoResolved) || 'gemini-3.5-flash-lite';
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

  const attemptUnaryWithRetry = async (modelToRun: string, maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await client.models.generateContent({
          model: modelToRun,
          contents,
          config,
        });
      } catch (err: any) {
        const parsed = parseAndCategorizeError(err, modelToRun);
        if (parsed.isRetryable && attempt < maxRetries) {
          const delayMs = Math.min(
            4000,
            Math.round(
              (parsed.retryAfterSec ? parsed.retryAfterSec * 1000 : 1000) * Math.pow(1.5, attempt) +
                Math.random() * 400
            )
          );
          console.warn(
            `[AI Service Unary] [${requestId}] [${modelToRun}] Transient ${parsed.category} (HTTP ${parsed.statusCode}). Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
  };

  try {
    response = await attemptUnaryWithRetry(targetModel, 2);
  } catch (err: any) {
    const parsedErr = parseAndCategorizeError(err, targetModel);
    if (isAuto && (parsedErr.category === 'overloaded' || parsedErr.category === 'quota')) {
      const fallback =
        targetModel === 'gemini-3.5-flash-lite' ? 'gemini-3.5-flash' : 'gemini-3.5-flash-lite';
      activeModel = fallback;
      console.warn(`[AI Service Unary] Auto failover from ${targetModel} to ${fallback}`);
      response = await attemptUnaryWithRetry(fallback, 1);
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
// 7. DEEP HEALTH DIAGNOSTICS
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

  const testModelId = 'gemini-3.5-flash-lite';

  const report: HealthDiagnosticReport = {
    status: 'unconfigured',
    environment,
    isVercel,
    configured,
    apiConnectivity: 'disconnected',
    availableModels: Object.keys(MODEL_REGISTRY),
    testedModel: {
      id: testModelId,
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

    const pingRes = await client.models.generateContent({
      model: testModelId,
      contents: 'ping',
    });

    if (pingRes && pingRes.text !== undefined) {
      report.apiConnectivity = 'connected';
      report.status = 'healthy';
      report.testedModel = {
        id: testModelId,
        status: 'ok',
        latencyMs: Date.now() - pingStart,
      };
    }
  } catch (err: any) {
    const parsed = parseAndCategorizeError(err, testModelId);
    report.testedModel = {
      id: testModelId,
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
    } else if (parsed.category === 'overloaded' || parsed.category === 'quota') {
      report.apiConnectivity = 'connected';
      report.status = 'degraded';
    } else {
      report.apiConnectivity = 'disconnected';
      report.status = 'unhealthy';
    }
  }

  return report;
}
