import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// SYSTEM INSTRUCTIONS & PERSONALITY PROMPT
// ============================================================================

const BASE_PERSONALITY_PROMPT = `You are an advanced, natural, highly capable AI assistant with a ChatGPT-inspired conversational elegance and dynamic personality.

CORE PERSONALITY ATTRIBUTES:
- Natural, engaging, perceptive, articulate, and authentic.
- You can be professional, friendly, humorous, playful, empathetic, serious, or lightly sarcastic depending on the user's tone and context.
- When the user is frustrated, struggling, or discussing a serious problem, you immediately show genuine empathy and prioritize fixing the issue directly.
- When the conversation is casual, you can make lighthearted, clever, or witty remarks.
- You understand jokes, irony, slang, sarcasm, and emotional subtext.
- Automatically detect the user's language and reply in the exact same language (e.g. English, Urdu, Roman Urdu, Hindi, Spanish, French, etc.).

PROBLEM-SOLVING & CODE PRINCIPLES:
- Answer the user's actual question first.
- Keep simple questions simple. Provide rich, deep walkthroughs for complex engineering or reasoning problems.
- If the user requests code, output clean, production-ready, well-formatted code with concise explanation.
- If you do not know something, honestly acknowledge it instead of hallucinating.`;

const STYLE_INSTRUCTIONS: Record<string, string> = {
  balanced: 'RESPONSE STYLE — BALANCED:\nProvide a natural, engaging, and well-balanced response. Clear, helpful, pleasant, with relatable examples when helpful.',
  research: 'RESPONSE STYLE — RESEARCH ANALYST:\nPerform a deep dive into the topic. Analyze information, summarize key findings with clear structure, and provide a comprehensive report.',
  creative: 'RESPONSE STYLE — CREATIVE DIRECTOR:\nWrite imaginative, visually evocative responses with rich, specific details.',
  coding: 'RESPONSE STYLE — CODING EXPERT:\nAct as a principal software engineer. Provide high-performance, idiomatic, fully-typed code. Minimal fluff, maximum technical precision.',
  concise: 'RESPONSE STYLE — CONCISE:\nBe extremely direct, punchy, and brief. Deliver the exact answer in as few words as possible without sacrificing correctness.',
  detailed: 'RESPONSE STYLE — DETAILED:\nProvide a comprehensive, in-depth explanation. Break down concepts step-by-step, cover edge cases, and explain the why.',
  professional: 'RESPONSE STYLE — PROFESSIONAL:\nUse a formal, polished executive tone. Structure points logically. Maintain objective, authoritative, concise business language.',
  friendly: 'RESPONSE STYLE — FRIENDLY & EMPATHETIC:\nWarm, cheerful, encouraging, and highly supportive. Approach the conversation with patience and kindness.',
  funny: 'RESPONSE STYLE — FUNNY & WITTY:\nInfuse the answer with humor, playful banter, clever analogies, and lighthearted wit while accurately answering.',
};

function buildSystemInstruction(style: string, customPersona?: string): string {
  const parts: string[] = [BASE_PERSONALITY_PROMPT];
  if (STYLE_INSTRUCTIONS[style]) {
    parts.push(STYLE_INSTRUCTIONS[style]);
  }
  if (customPersona && customPersona.trim() && customPersona.trim() !== BASE_PERSONALITY_PROMPT) {
    parts.push(`USER CUSTOM INSTRUCTIONS:\n${customPersona.trim()}`);
  }
  return parts.join('\n\n');
}

// ============================================================================
// SUPPORTED MODELS & ROUTING
// ============================================================================

const SUPPORTED_MODELS: Record<string, string> = {
  'gemini-3.5-flash': 'gemini-3.5-flash',
  'gemini-3.8-flash': 'gemini-3.8-flash',
  'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite',
  // Backward compatibility aliases
  'gemini-2.5-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash': 'gemini-3.5-flash',
  'gemini-1.5-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-flash-latest': 'gemini-3.5-flash',
  'gemini-flash-lite-latest': 'gemini-3.1-flash-lite',
  'gemini-4-argon': 'gemini-3.8-flash',
};

function resolveAutoModel(promptText: string, hasImage: boolean): string {
  if (hasImage) return 'gemini-3.8-flash';
  const lower = promptText.toLowerCase();
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
    lower.includes('calculate')
  ) {
    return 'gemini-3.8-flash';
  }
  return 'gemini-3.5-flash';
}

// ============================================================================
// ERROR PARSING & CLASSIFICATION
// ============================================================================

interface FormattedError {
  message: string;
  statusCode: number;
  category: string;
}

function parseAndCategorizeError(err: unknown, modelId: string): FormattedError {
  let raw = (err as any)?.message || String(err || '');
  let status = Number((err as any)?.status || (err as any)?.statusCode || 500);

  try {
    const parsed = JSON.parse(raw);
    if (parsed.error?.message) {
      raw = parsed.error.message;
      if (parsed.error.code) status = Number(parsed.error.code);
    }
    if (typeof raw === 'string' && raw.startsWith('{')) {
      try {
        const nested = JSON.parse(raw);
        if (nested.error?.message) {
          raw = nested.error.message;
          if (nested.error.code) status = Number(nested.error.code);
        }
      } catch {}
    }
  } catch {}

  const lowerRaw = raw.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    lowerRaw.includes('api_key_invalid') ||
    lowerRaw.includes('api key not valid') ||
    lowerRaw.includes('unauthenticated') ||
    lowerRaw.includes('permission_denied')
  ) {
    return {
      message: 'Authentication failed: Invalid or missing Gemini API key. Please check your GEMINI_API_KEY environment variable in Vercel.',
      statusCode: 401,
      category: 'auth',
    };
  }

  if (
    status === 402 ||
    lowerRaw.includes('billing') ||
    lowerRaw.includes('payment')
  ) {
    return {
      message: 'Gemini API billing error: Payment or billing account issue. Please verify your Google Cloud / AI Studio billing status.',
      statusCode: 402,
      category: 'billing',
    };
  }

  if (
    status === 429 ||
    lowerRaw.includes('resource_exhausted') ||
    lowerRaw.includes('quota') ||
    lowerRaw.includes('rate limit')
  ) {
    return {
      message: `Rate limit or quota reached for "${modelId}". Please wait a few seconds before retrying, or select Gemini 3.5 Flash.`,
      statusCode: 429,
      category: 'quota',
    };
  }

  if (
    status === 404 ||
    lowerRaw.includes('not_found') ||
    lowerRaw.includes('not found') ||
    lowerRaw.includes('no longer available') ||
    lowerRaw.includes('does not exist')
  ) {
    return {
      message: `Model "${modelId}" is not available or not supported on this account. Please select Gemini 3.5 Flash or Gemini 3.1 Flash Lite.`,
      statusCode: 404,
      category: 'model_not_found',
    };
  }

  if (
    status === 503 ||
    lowerRaw.includes('unavailable') ||
    lowerRaw.includes('high demand') ||
    lowerRaw.includes('overloaded')
  ) {
    return {
      message: `Model "${modelId}" is currently experiencing high demand upstream at Google. Please try again in a moment or switch to Gemini 3.5 Flash.`,
      statusCode: 503,
      category: 'overloaded',
    };
  }

  if (status === 400 || lowerRaw.includes('invalid_argument')) {
    return {
      message: `Invalid request payload sent to Gemini API: ${raw.slice(0, 160)}`,
      statusCode: 400,
      category: 'invalid_request',
    };
  }

  return {
    message: raw && raw.length < 200 ? raw : `An unexpected error occurred while communicating with model "${modelId}".`,
    statusCode: 500,
    category: 'internal',
  };
}

// ============================================================================
// MAIN VERCEL SERVERLESS HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  // 2. Validate API key
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.length < 8) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured in Vercel project environment variables. Add GEMINI_API_KEY under Project Settings -> Environment Variables.',
      category: 'auth',
    });
    return;
  }

  // 3. Validate request payload
  const {
    messages,
    model: requestedModel = 'auto',
    responseStyle = 'balanced',
    temperature = 0.7,
    systemInstruction,
    searchGrounding = false,
    stream = true,
  } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'Messages array is required and must not be empty.',
      category: 'invalid_request',
    });
    return;
  }

  // 4. Resolve target model
  const isAuto = requestedModel === 'auto';
  let targetModel: string;

  if (isAuto) {
    const latestMsg = messages[messages.length - 1];
    const hasImage = Boolean(latestMsg?.image?.url);
    const promptText = latestMsg?.content || '';
    targetModel = resolveAutoModel(promptText, hasImage);
  } else {
    targetModel = SUPPORTED_MODELS[requestedModel] || requestedModel;
  }

  // 5. Build contents array (pruned to last 10 messages, image only on latest to prevent payload bloat)
  const recentMessages = messages.slice(-10);
  let lastImageIdx = -1;
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    if (recentMessages[i].image?.url?.startsWith('data:')) {
      lastImageIdx = i;
      break;
    }
  }

  const contents = recentMessages.map((m: any, idx: number) => {
    const parts: any[] = [];
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
    if (m.content && String(m.content).trim()) {
      parts.push({ text: String(m.content) });
    } else if (parts.length === 0) {
      parts.push({ text: ' ' });
    }
    return {
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const compositeInstruction = buildSystemInstruction(responseStyle, systemInstruction);
  const config: Record<string, any> = {
    temperature: Math.max(0, Math.min(1.5, Number(temperature) || 0.7)),
    systemInstruction: compositeInstruction,
  };

  if (searchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'gemini-studio-pro/2.0',
      },
    },
  });

  const startTime = Date.now();
  let isClientClosed = false;
  req.on('close', () => {
    isClientClosed = true;
  });

  // 6. Streaming SSE response
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    let accumulatedText = '';
    let chunkCount = 0;
    let activeModel = targetModel;

    const tryStream = async (modelId: string) => {
      const responseStream = await client.models.generateContentStream({
        model: modelId,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        if (isClientClosed) break;
        const delta = chunk.text;
        if (delta) {
          accumulatedText += delta;
          chunkCount++;
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      }
    };

    try {
      try {
        await tryStream(targetModel);
      } catch (firstErr: any) {
        const parsed = parseAndCategorizeError(firstErr, targetModel);
        // Single controlled failover in auto mode only on transient 503
        if (isAuto && parsed.category === 'overloaded' && accumulatedText.length === 0 && !isClientClosed) {
          const fallback = targetModel === 'gemini-3.5-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
          activeModel = fallback;
          await tryStream(fallback);
        } else {
          throw firstErr;
        }
      }

      if (!isClientClosed) {
        const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
        const estimatedTokens = Math.max(Math.round(accumulatedText.length / 4), chunkCount);
        const speed = Math.round(estimatedTokens / durationSec);

        res.write(
          `data: ${JSON.stringify({
            done: true,
            tokens: estimatedTokens,
            speed,
            modelUsed: activeModel,
          })}\n\n`
        );
        res.end();
      }
    } catch (err: unknown) {
      if (!isClientClosed) {
        const formatted = parseAndCategorizeError(err, activeModel);
        res.write(
          `data: ${JSON.stringify({
            error: formatted.message,
            category: formatted.category,
            model: activeModel,
            statusCode: formatted.statusCode,
          })}\n\n`
        );
        res.end();
      }
    }
    return;
  }

  // 7. Non-streaming unary response
  try {
    let activeModel = targetModel;
    let response: any = null;

    try {
      response = await client.models.generateContent({
        model: targetModel,
        contents,
        config,
      });
    } catch (firstErr: any) {
      const parsed = parseAndCategorizeError(firstErr, targetModel);
      if (isAuto && parsed.category === 'overloaded') {
        const fallback = targetModel === 'gemini-3.5-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
        activeModel = fallback;
        response = await client.models.generateContent({
          model: fallback,
          contents,
          config,
        });
      } else {
        throw firstErr;
      }
    }

    const text = response?.text || '';
    const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
    const estimatedTokens = Math.max(Math.round(text.length / 4), 1);
    const speed = Math.round(estimatedTokens / durationSec);

    res.status(200).json({
      text,
      tokens: estimatedTokens,
      speed,
      modelUsed: activeModel,
    });
  } catch (err: unknown) {
    const formatted = parseAndCategorizeError(err, targetModel);
    res.status(formatted.statusCode).json({
      error: formatted.message,
      category: formatted.category,
      model: targetModel,
    });
  }
}
