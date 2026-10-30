import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---- Shared helpers (inlined to avoid .ts extension imports in serverless) ----

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
  if (customPersona && customPersona.trim()) {
    parts.push(`USER CUSTOM INSTRUCTIONS:\n${customPersona.trim()}`);
  }
  return parts.join('\n\n');
}

// ---- Current Gemini model IDs (confirmed live from Google API error response) ----
// gemini-2.0-flash is deprecated — Google now uses gemini-3.x naming
const MODEL_MAP: Record<string, string> = {
  'auto':                  'gemini-3.8-flash',
  'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-3.8-flash':      'gemini-3.8-flash',
  'gemini-4-argon':        'gemini-3.8-flash',
};

const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function resolveModel(requested: string): string {
  return MODEL_MAP[requested] || FALLBACK_MODEL;
}

function extractFriendlyError(err: unknown): string {
  const raw = (err as any)?.message || String(err || '');
  if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
    return 'The AI model is experiencing high demand. Please try again in a moment.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return 'Rate limit reached. Please wait a few seconds before retrying.';
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid') || raw.includes('401')) {
    return 'Invalid or missing Gemini API key. Set GEMINI_API_KEY in your Vercel environment variables.';
  }
  if (raw.includes('402') || raw.includes('billing') || raw.includes('Payment')) {
    return 'Gemini API billing issue. Please check your Google Cloud billing account.';
  }
  return raw || 'An unexpected error occurred while processing your request.';
}

// ---- Main handler ----
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
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
      error: 'GEMINI_API_KEY is not configured. Add it to your Vercel project environment variables at vercel.com/dashboard → Project → Settings → Environment Variables.',
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

  const resolvedModel = resolveModel(requestedModel);
  const compositeInstruction = buildSystemInstruction(responseStyle, systemInstruction);

  const client = new GoogleGenAI({ apiKey });

  // Build contents — last 12 messages max
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

    let accumulatedText = '';
    let chunkCount = 0;

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
        }
      }
    };

    try {
      try {
        await tryStream(resolvedModel);
      } catch (firstErr: any) {
        const errStr = String(firstErr?.message || firstErr || '');
        const isRetriable =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED');

        if (isRetriable) {
          const fallback = resolvedModel === 'gemini-3.1-flash-lite'
            ? 'gemini-3.8-flash'
            : 'gemini-3.1-flash-lite';
          await tryStream(fallback);
        } else {
          throw firstErr;
        }
      }

      const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
      const estimatedTokens = Math.max(Math.round(accumulatedText.length / 4), chunkCount);
      const tokPerSec = Math.round(estimatedTokens / durationSec);

      res.write(`data: ${JSON.stringify({ done: true, tokens: estimatedTokens, speed: tokPerSec, modelUsed: resolvedModel })}\n\n`);
      res.end();
    } catch (err: unknown) {
      console.error('[Chat Stream Error]:', err);
      res.write(`data: ${JSON.stringify({ error: extractFriendlyError(err) })}\n\n`);
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
      const fallback = resolvedModel === 'gemini-3.1-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
      usedModel = fallback;
      response = await client.models.generateContent({ model: fallback, contents, config });
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
    res.status(500).json({ error: extractFriendlyError(err) });
  }
}
