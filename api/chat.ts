import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---- System instruction helpers (inlined to avoid .ts extension import issues in serverless) ----

const BASE_PERSONALITY_PROMPT = `You are an advanced, natural, highly capable AI assistant with a ChatGPT-inspired conversational elegance and dynamic personality.

CORE PERSONALITY ATTRIBUTES:
- Natural, engaging, perceptive, articulate, and authentic.
- You can be professional, friendly, humorous, playful, empathetic, serious, or lightly sarcastic depending on the user's tone and context.
- When the user is frustrated, struggling, or discussing a serious problem, you immediately show genuine empathy and prioritize fixing the issue directly.
- When the conversation is casual, you can make lighthearted, clever, or witty remarks.
- You understand jokes, irony, slang, sarcasm, and emotional subtext.
- Automatically detect the user's language and reply in the exact same language.

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
  if (STYLE_INSTRUCTIONS[style]) parts.push(STYLE_INSTRUCTIONS[style]);
  if (customPersona && customPersona.trim() && customPersona.trim() !== BASE_PERSONALITY_PROMPT) {
    parts.push(`USER CUSTOM INSTRUCTIONS:\n${customPersona.trim()}`);
  }
  return parts.join('\n\n');
}

// ---- Real Gemini API model IDs (verified against Google Generative AI API) ----
// These are the actual model IDs accepted by the Gemini API as of 2025.
const MODEL_MAP: Record<string, string> = {
  'auto':                  'gemini-2.0-flash',       // default for auto
  'gemini-2.0-flash-lite': 'gemini-2.0-flash-lite',  // ultra-fast
  'gemini-2.0-flash':      'gemini-2.0-flash',       // fast & smart
  'gemini-2.5-flash':      'gemini-2.5-flash',       // flagship
  'gemini-2.5-pro':        'gemini-2.5-pro',         // deep reasoning
};

// Models that support automatic fallback (auto mode only)
const AUTO_FALLBACK_MODEL = 'gemini-2.0-flash-lite';

function resolveAutoModel(promptText: string, hasImage: boolean): string {
  if (hasImage) return 'gemini-2.0-flash';

  const p = promptText.toLowerCase();

  // Math, STEM, complex reasoning → use 2.5 flash
  if (/\b(math|calculus|equation|theorem|proof|algorithm|probability|physics|solve|quadratic|derivative|integral)\b/i.test(p)) {
    return 'gemini-2.5-flash';
  }

  // Deep coding tasks → use 2.5 flash
  if (/\b(refactor|architecture|system design|concurrency|deadlock|dockerfile|kubernetes|dynamic programming|compiler)\b/i.test(p) || /```[\s\S]*```/.test(promptText)) {
    return 'gemini-2.5-flash';
  }

  // General / casual → use lite for speed
  return 'gemini-2.0-flash-lite';
}

function extractFriendlyError(err: unknown, modelId?: string): { message: string; statusCode: number } {
  const raw = (err as any)?.message || String(err || '');

  if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
    return { message: 'The AI model is experiencing high demand. Please try again in a moment.', statusCode: 503 };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return { message: 'Rate limit reached. Please wait a few seconds before retrying.', statusCode: 429 };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid') || raw.includes('401')) {
    return { message: 'Invalid or missing Gemini API key. Set GEMINI_API_KEY in your Vercel environment variables.', statusCode: 401 };
  }
  if (raw.includes('404') || raw.includes('not found') || raw.includes('does not exist')) {
    return { message: modelId ? `Model "${modelId}" is not available. Please select a different model.` : 'Requested model is not available.', statusCode: 404 };
  }
  if (raw.includes('402') || raw.includes('billing') || raw.includes('Payment')) {
    return { message: 'Gemini API billing issue. Please check your Google Cloud billing account.', statusCode: 402 };
  }
  if (raw.includes('400') || raw.includes('invalid')) {
    return { message: 'Invalid request sent to AI. Please try again.', statusCode: 400 };
  }
  return { message: raw || 'An unexpected error occurred while processing your request.', statusCode: 500 };
}

// ---- Main handler ----
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.length < 10) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Add it to your Vercel project at: vercel.com/dashboard → Project → Settings → Environment Variables.',
    });
    return;
  }

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
    res.status(400).json({ error: 'messages array is required and must not be empty.' });
    return;
  }

  // --- Model Resolution ---
  // For 'auto', intelligently pick a real model.
  // For manual selection, validate the model ID strictly — never silently switch.
  const isAutoMode = requestedModel === 'auto';
  let resolvedModel: string;

  if (isAutoMode) {
    const latestMsg = messages[messages.length - 1];
    const hasImage = Boolean(latestMsg?.image?.url);
    const promptText = latestMsg?.content || '';
    resolvedModel = resolveAutoModel(promptText, hasImage);
  } else {
    // Strict validation — reject unknown models instead of silently using fallback
    if (!MODEL_MAP[requestedModel]) {
      res.status(400).json({
        error: `Unknown model: "${requestedModel}". Supported models: ${Object.keys(MODEL_MAP).filter(k => k !== 'auto').join(', ')}`,
      });
      return;
    }
    resolvedModel = MODEL_MAP[requestedModel];
  }

  const compositeInstruction = buildSystemInstruction(responseStyle, systemInstruction);
  const client = new GoogleGenAI({ apiKey });

  // Build contents — last 12 messages max to avoid excessive payload
  const recentMessages = messages.slice(-12);
  const contents = recentMessages.map((m: any) => {
    const parts: any[] = [];
    if (m.image?.url && m.image.url.startsWith('data:')) {
      const match = m.image.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    if (m.content) {
      parts.push({ text: String(m.content) });
    } else if (parts.length === 0) {
      parts.push({ text: ' ' });
    }
    return {
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const config: Record<string, any> = {
    temperature: Math.max(0, Math.min(2, Number(temperature) || 0.7)),
    systemInstruction: compositeInstruction,
  };

  if (searchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const startTime = Date.now();

  // ---- Streaming response ----
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // CRITICAL: flush headers immediately so Vercel starts streaming
    (res as any).flushHeaders?.();

    let accumulatedText = '';
    let chunkCount = 0;
    let activeModel = resolvedModel;

    const tryStream = async (modelId: string) => {
      const responseStream = await client.models.generateContentStream({
        model: modelId,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        const delta = chunk.text;
        if (delta) {
          accumulatedText += delta;
          chunkCount++;
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          // Flush after each chunk to ensure Vercel doesn't buffer
          (res as any).flush?.();
        }
      }
    };

    try {
      try {
        await tryStream(resolvedModel);
      } catch (firstErr: any) {
        const errStr = String(firstErr?.message || firstErr || '');
        const isTransient =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED');

        // Only auto-fallback in auto mode for transient errors
        // Never silently switch on manually selected models
        if (isAutoMode && isTransient) {
          activeModel = AUTO_FALLBACK_MODEL;
          // Notify frontend about the model switch
          res.write(`data: ${JSON.stringify({ info: `Switched to ${AUTO_FALLBACK_MODEL} due to high demand.` })}\n\n`);
          await tryStream(AUTO_FALLBACK_MODEL);
        } else {
          throw firstErr;
        }
      }

      const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
      const estimatedTokens = Math.max(Math.round(accumulatedText.length / 4), chunkCount);
      const tokPerSec = Math.round(estimatedTokens / durationSec);

      res.write(`data: ${JSON.stringify({ done: true, tokens: estimatedTokens, speed: tokPerSec, modelUsed: activeModel })}\n\n`);
      res.end();
    } catch (err: unknown) {
      console.error('[Chat Stream Error]:', err);
      const { message } = extractFriendlyError(err, resolvedModel);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
    return;
  }

  // ---- Non-streaming response ----
  try {
    let usedModel = resolvedModel;
    let response;
    try {
      response = await client.models.generateContent({ model: resolvedModel, contents, config });
    } catch (firstErr: any) {
      const errStr = String(firstErr?.message || firstErr || '');
      const isTransient = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED');

      if (isAutoMode && isTransient) {
        usedModel = AUTO_FALLBACK_MODEL;
        response = await client.models.generateContent({ model: AUTO_FALLBACK_MODEL, contents, config });
      } else {
        throw firstErr;
      }
    }

    const text = response.text || '';
    const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
    const estimatedTokens = Math.max(Math.round(text.length / 4), 1);

    res.status(200).json({
      text,
      tokens: estimatedTokens,
      speed: Math.round(estimatedTokens / durationSec),
      modelUsed: usedModel,
    });
  } catch (err: unknown) {
    console.error('[Chat Generate Error]:', err);
    const { message, statusCode } = extractFriendlyError(err, resolvedModel);
    res.status(statusCode).json({ error: message });
  }
}
