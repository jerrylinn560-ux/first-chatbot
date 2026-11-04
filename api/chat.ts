import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeAIChatStream,
  executeAIChatUnary,
  parseAndCategorizeError,
} from '../src/lib/ai/ai-service';

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
    model = 'auto',
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

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 4. Client disconnect tracking
  let isClientClosed = false;
  req.on('close', () => {
    isClientClosed = true;
  });

  // 5. Streaming response path
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    await executeAIChatStream({
      apiKey,
      messages,
      model,
      responseStyle,
      temperature,
      systemInstruction,
      searchGrounding,
      requestId,
      isAborted: () => isClientClosed,
      onChunk: (delta: string) => {
        if (!isClientClosed) {
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      },
      onDone: (telemetry) => {
        if (!isClientClosed) {
          res.write(
            `data: ${JSON.stringify({
              done: true,
              tokens: telemetry.tokens,
              speed: telemetry.speed,
              modelUsed: telemetry.modelUsed,
              durationMs: telemetry.durationMs,
              ttftMs: telemetry.ttftMs,
            })}\n\n`
          );
          res.end();
        }
      },
      onError: (err) => {
        if (!isClientClosed) {
          res.write(
            `data: ${JSON.stringify({
              error: err.message,
              category: err.category,
              model: err.modelId,
              statusCode: err.statusCode,
            })}\n\n`
          );
          res.end();
        }
      },
    });
    return;
  }

  // 6. Unary / Non-streaming path
  try {
    const result = await executeAIChatUnary({
      apiKey,
      messages,
      model,
      responseStyle,
      temperature,
      systemInstruction,
      searchGrounding,
      requestId,
    });
    res.status(200).json(result);
  } catch (err: unknown) {
    const formatted = parseAndCategorizeError(err, model);
    res.status(formatted.statusCode).json({
      error: formatted.message,
      category: formatted.category,
      model: formatted.modelId,
    });
  }
}
