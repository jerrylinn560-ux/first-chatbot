import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---- System instruction helpers ----

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

// Supported Gemini models with Gemini 3.8 Flash as the flagship model
const DEFAULT_MODEL = 'gemini-3.8-flash';

const MODEL_MAP: Record<string, string> = {
  'auto':                   DEFAULT_MODEL,
  'gemini-3.8-flash':       'gemini-3.8-flash',
  'gemini-3.1-flash-lite':  'gemini-2.5-flash', // graceful alias
  'gemini-4-argon':         'gemini-2.5-pro',   // graceful alias
  'gemini-2.5-flash':       'gemini-2.5-flash',
  'gemini-2.5-pro':         'gemini-2.5-pro',
  'gemini-2.0-flash':       'gemini-2.0-flash',
  'gemini-2.0-flash-lite':  'gemini-2.0-flash-lite',
  'gemini-1.5-flash':       'gemini-1.5-flash',
};

// Fallback chain for uninterrupted generation
function getCandidateModels(primary: string): string[] {
  const chain: string[] = [];
  const add = (m: string) => {
    if (m && !chain.includes(m)) chain.push(m);
  };

  add(primary);
  add('gemini-2.5-flash');
  add('gemini-2.0-flash');
  add('gemini-1.5-flash');
  return chain;
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

  const resolvedModel = MODEL_MAP[requestedModel] || DEFAULT_MODEL;
  const candidateModels = getCandidateModels(resolvedModel);

  const compositeInstruction = buildSystemInstruction(responseStyle, systemInstruction);
  const client = new GoogleGenAI({ apiKey });

  // Build contents — last 10 messages max to avoid excessive payload
  const recentMessages = messages.slice(-10);
  const contents = recentMessages.map((m: any, idx: number) => {
    const parts: any[] = [];
    // Only send heavy image data on the most recent 2 messages to prevent payload bloat & high latency
    const isRecent = idx >= recentMessages.length - 2;
    if (isRecent && m.image?.url && m.image.url.startsWith('data:')) {
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
    (res as any).flushHeaders?.();

    let accumulatedText = '';
    let chunkCount = 0;
    let activeModel = resolvedModel;
    let streamedSuccessfully = false;
    let lastError: any = null;

    for (const modelId of candidateModels) {
      try {
        const responseStream = await client.models.generateContentStream({
          model: modelId,
          contents,
          config,
        });

        activeModel = modelId;

        for await (const chunk of responseStream) {
          const delta = chunk.text;
          if (delta) {
            accumulatedText += delta;
            chunkCount++;
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
            (res as any).flush?.();
          }
        }

        streamedSuccessfully = true;
        break; // Successfully completed streaming!
      } catch (err: any) {
        lastError = err;
        // If we already started streaming text to user, do not restart
        if (accumulatedText.length > 0) {
          break;
        }
        console.warn(`[Model ${modelId} unavailable, failing over to next model]:`, err?.message || err);
      }
    }

    if (streamedSuccessfully || accumulatedText.length > 0) {
      const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
      const estimatedTokens = Math.max(Math.round(accumulatedText.length / 4), chunkCount);
      const tokPerSec = Math.round(estimatedTokens / durationSec);

      res.write(`data: ${JSON.stringify({ done: true, tokens: estimatedTokens, speed: tokPerSec, modelUsed: activeModel })}\n\n`);
      res.end();
    } else {
      console.error('[All Candidate Models Failed]:', lastError);
      const { message } = extractFriendlyError(lastError, resolvedModel);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
    return;
  }

  // ---- Non-streaming response ----
  let response: any = null;
  let usedModel = resolvedModel;
  let lastErr: any = null;

  for (const modelId of candidateModels) {
    try {
      response = await client.models.generateContent({ model: modelId, contents, config });
      usedModel = modelId;
      break;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Non-stream Model ${modelId} failed, failing over]:`, err?.message || err);
    }
  }

  if (response) {
    const text = response.text || '';
    const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
    const estimatedTokens = Math.max(Math.round(text.length / 4), 1);

    res.status(200).json({
      text,
      tokens: estimatedTokens,
      speed: Math.round(estimatedTokens / durationSec),
      modelUsed: usedModel,
    });
  } else {
    console.error('[All Non-stream Candidate Models Failed]:', lastErr);
    const { message, statusCode } = extractFriendlyError(lastErr, resolvedModel);
    res.status(statusCode).json({ error: message });
  }
}
