import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  buildCompositeSystemInstruction,
  detectRepeatedQuestion,
} from './src/lib/ai/system-instructions';
import { resolveAutoModel } from './src/lib/ai/model-router';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Increased limit for base64 image uploads
app.use(express.json({ limit: '25mb' }));

const getApiKey = (): string => {
  return process.env.GEMINI_API_KEY || '';
};

const createGeminiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in your deployment environment.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// UI display names → real Gemini API model IDs
const MODEL_MAP: Record<string, string> = {
  'auto':                   'gemini-2.0-flash',
  'gemini-3.1-flash-lite':  'gemini-2.0-flash-lite',
  'gemini-3.8-flash':       'gemini-2.0-flash',
  'gemini-4-argon':         'gemini-2.5-flash-preview-05-20',
  // Allow real model IDs to pass through
  'gemini-2.0-flash':       'gemini-2.0-flash',
  'gemini-2.0-flash-lite':  'gemini-2.0-flash-lite',
  'gemini-1.5-flash':       'gemini-1.5-flash',
  'gemini-1.5-pro':         'gemini-1.5-pro',
};

const ALLOWED_MODELS = new Set(Object.keys(MODEL_MAP));
const FALLBACK_MODEL = 'gemini-2.0-flash-lite';

function extractFriendlyErrorMessage(err: any): string {
  let raw = err?.message || String(err || '');

  try {
    const parsed = JSON.parse(raw);
    if (parsed.error?.message) {
      try {
        const nested = JSON.parse(parsed.error.message);
        if (nested.error?.message) raw = nested.error.message;
      } catch {
        raw = parsed.error.message;
      }
    }
  } catch {}

  if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
    return 'The AI model is experiencing high demand. Please try again in a moment.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return 'Free tier rate limit reached. Please wait a few seconds before retrying.';
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local.';
  }
  return raw || 'An unexpected error occurred while processing your request.';
}

// ----------------- API ENDPOINTS -----------------

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const apiKey = getApiKey();
  res.json({
    status: 'healthy',
    configured: Boolean(apiKey && apiKey.length > 5),
    defaultModel: 'gemini-3.1-flash-lite',
    timestamp: Date.now(),
  });
});

// Models list endpoint
app.get('/api/models', (_req: Request, res: Response) => {
  res.json([
    {
      id: 'auto',
      name: 'Auto (Smart Router)',
      badge: 'Intelligent',
      description: 'Automatically routes to the best model based on question complexity & task',
      isFree: true,
      isDefault: true,
      isAuto: true,
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite',
      badge: 'Ultra Fast',
      description: 'Fastest response time, low latency, ideal for conversation & quick answers',
      isFree: true,
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      badge: 'Flagship',
      description: 'High intelligence, multimodal vision analysis, and creative synthesis',
      isFree: true,
    },
    {
      id: 'gemini-4-argon',
      name: 'Gemini 4 Argon',
      badge: 'Deep Reasoning',
      description: 'Advanced mathematical logic, complex STEM, and deep coding architecture',
      isFree: false,
    },
  ]);
});

// Dedicated Real AI Image Generation endpoint
app.post('/api/images/generate', async (req: Request, res: Response) => {
  const { prompt, aspectRatio = '1:1', style = 'photorealistic', provider = 'pollinations' } =
    req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Prompt is required for image generation.' });
    return;
  }

  const cleanPrompt = prompt.trim();
  const styledPrompt = `${cleanPrompt}, ${style} style, high quality, highly detailed`;

  // Calculate pixel dimensions based on aspect ratio
  let width = 1024;
  let height = 1024;
  if (aspectRatio === '16:9') {
    width = 1024;
    height = 576;
  } else if (aspectRatio === '9:16') {
    width = 576;
    height = 1024;
  } else if (aspectRatio === '4:3') {
    width = 1024;
    height = 768;
  }

  // Attempt Google Gemini Image if requested
  if (provider === 'gemini') {
    try {
      if (!getApiKey()) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured. Add it to the Vercel project environment variables.',
        });
        return;
      }

      const client = createGeminiClient();
      const geminiRes = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: styledPrompt,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
          },
        },
      });

      let base64Img = '';
      for (const part of geminiRes.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          base64Img = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (base64Img) {
        res.json({
          imageUrl: base64Img,
          prompt: cleanPrompt,
          aspectRatio,
          style,
          provider: 'Google Gemini Image',
          createdAt: Date.now(),
        });
        return;
      }
    } catch (geminiErr: any) {
      console.warn('Gemini image generation unavailable, falling back to AI Engine:', geminiErr?.message);
    }
  }

  // Pollinations AI Real-Time Image Generation Engine (SDXL / Flux)
  try {
    const encodedPrompt = encodeURIComponent(styledPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

    res.json({
      imageUrl,
      prompt: cleanPrompt,
      aspectRatio,
      style,
      provider: 'Flux / Pollinations AI',
      createdAt: Date.now(),
    });
  } catch (err: any) {
    console.error('Image generation error:', err);
    res.status(500).json({ error: 'Failed to generate image. Please try another prompt.' });
  }
});

// Chat completion endpoint (with streaming SSE, multimodal vision, repeated-question & personality styles)
app.post('/api/chat', async (req: Request, res: Response) => {
  const {
    messages,
    model: requestedModel = 'auto',
    responseStyle = 'balanced',
    temperature = 0.7,
    systemInstruction,
    searchGrounding = false,
    stream = true,
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required and must not be empty.' });
    return;
  }

  const latestMsg = messages[messages.length - 1];
  const hasImageAttachment = Boolean(latestMsg?.image?.url);
  const promptText = latestMsg?.content || '';

  // Smart Model Routing — translate UI model name to real Gemini API model ID
  let resolvedModel = MODEL_MAP['gemini-3.1-flash-lite'];
  if (requestedModel === 'auto') {
    const autoResolved = resolveAutoModel(promptText, hasImageAttachment);
    resolvedModel = MODEL_MAP[autoResolved] || MODEL_MAP[autoResolved.replace('gemini-', '')] || 'gemini-2.0-flash';
  } else if (ALLOWED_MODELS.has(requestedModel)) {
    resolvedModel = MODEL_MAP[requestedModel] || FALLBACK_MODEL;
  }

  // Detect repeated question in this conversation
  const repeatedInfo = detectRepeatedQuestion(promptText, messages.slice(0, -1));

  // Build composite personality & style instructions
  const compositeInstruction = buildCompositeSystemInstruction(
    responseStyle,
    systemInstruction,
    repeatedInfo
  );

  if (!getApiKey()) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Add it to the Vercel project environment variables.',
    });
    return;
  }

  const client = createGeminiClient();

  // Format contents array (handles multimodal images and text parts)
  const recentMessages = messages.slice(-12);
  const contents = recentMessages.map((m: any) => {
    const parts: any[] = [];

    // If message contains an attached image (dataUrl)
    if (m.image?.url && m.image.url.startsWith('data:')) {
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
    temperature: Math.max(0, Math.min(1, Number(temperature) || 0.7)),
    systemInstruction: compositeInstruction,
  };

  if (searchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const startTime = Date.now();

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let isAborted = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        isAborted = true;
      }
    });

    let accumulatedText = '';
    let chunkCount = 0;
    let activeModel = resolvedModel;

    const tryStream = async (modelToUse: string) => {
      const responseStream = await client.models.generateContentStream({
        model: modelToUse,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        if (isAborted) break;

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
        if (
          (errStr.includes('503') ||
            errStr.includes('high demand') ||
            errStr.includes('UNAVAILABLE') ||
            errStr.includes('quota') ||
            errStr.includes('429')) &&
          !isAborted
        ) {
          // Automatic failover model
          const fallbackModel =
            resolvedModel === 'gemini-2.0-flash-lite'
              ? 'gemini-2.0-flash'
              : 'gemini-2.0-flash-lite';
          activeModel = fallbackModel;
          await tryStream(fallbackModel);
        } else {
          throw firstErr;
        }
      }

      if (!isAborted) {
        const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
        const estimatedTokens = Math.max(Math.round(accumulatedText.length / 4), chunkCount);
        const tokPerSec = Math.round(estimatedTokens / durationSec);

        res.write(
          `data: ${JSON.stringify({
            done: true,
            tokens: estimatedTokens,
            speed: tokPerSec,
            modelUsed: activeModel,
          })}\n\n`
        );
      }
      res.end();
    } catch (err: any) {
      console.error('[Gemini Stream Error]:', err);
      const friendlyError = extractFriendlyErrorMessage(err);
      res.write(`data: ${JSON.stringify({ error: friendlyError })}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming response
    try {
      let activeModel = resolvedModel;
      let response;
      try {
        response = await client.models.generateContent({
          model: resolvedModel,
          contents,
          config,
        });
      } catch (firstErr: any) {
        const fallbackModel =
          resolvedModel === 'gemini-2.0-flash-lite'
            ? 'gemini-2.0-flash'
            : 'gemini-2.0-flash-lite';
        activeModel = fallbackModel;
        response = await client.models.generateContent({
          model: fallbackModel,
          contents,
          config,
        });
      }

      const text = response.text || '';
      const durationSec = Math.max((Date.now() - startTime) / 1000, 0.05);
      const estimatedTokens = Math.max(Math.round(text.length / 4), 1);
      const tokPerSec = Math.round(estimatedTokens / durationSec);

      res.json({
        text,
        tokens: estimatedTokens,
        speed: tokPerSec,
        modelUsed: activeModel,
      });
    } catch (err: any) {
      console.error('[Gemini Generate Error]:', err);
      const friendlyError = extractFriendlyErrorMessage(err);
      res.status(500).json({ error: friendlyError });
    }
  }
});

// ----------------- VITE SERVER INTEGRATION -----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 ChatGPT Assistant server running on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

export default app;
