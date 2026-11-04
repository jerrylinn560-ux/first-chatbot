import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import {
  UI_MODEL_LIST,
  executeAIChatStream,
  executeAIChatUnary,
  parseAndCategorizeError,
  runHealthDiagnostics,
} from './src/lib/ai/ai-service';

// Load environment variables (.env.local overrides .env)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Increased limit for base64 image uploads
app.use(express.json({ limit: '25mb' }));

const getApiKey = (): string => {
  return process.env.GEMINI_API_KEY || '';
};

// ----------------- API ENDPOINTS -----------------

// Live Health & Diagnostics endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const apiKey = getApiKey();
  const report = await runHealthDiagnostics(apiKey);
  const status = report.status === 'healthy' ? 200 : report.status === 'degraded' ? 200 : 503;
  res.status(status).json(report);
});

// Models list endpoint (sourced from centralized model registry)
app.get('/api/models', (_req: Request, res: Response) => {
  res.json(UI_MODEL_LIST);
});

// Dedicated AI Image Generation endpoint (Flux / Pollinations AI)
app.post('/api/images/generate', async (req: Request, res: Response) => {
  const { prompt, aspectRatio = '1:1', style = 'photorealistic' } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Prompt is required for image generation.' });
    return;
  }

  const cleanPrompt = prompt.trim();
  const styledPrompt = `${cleanPrompt}, ${style} style, high quality, highly detailed`;

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

// Chat completion endpoint (with streaming SSE, multimodal vision & single shared AI logic)
app.post('/api/chat', async (req: Request, res: Response) => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.length < 8) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Add it to your .env.local file.',
      category: 'auth',
    });
    return;
  }

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

  const requestId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let isClientClosed = false;

  res.on('close', () => {
    if (!res.writableEnded) {
      isClientClosed = true;
    }
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

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
  } else {
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
      res.json(result);
    } catch (err: unknown) {
      const formatted = parseAndCategorizeError(err, model);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        category: formatted.category,
        model: formatted.modelId,
      });
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
    console.log(`🚀 AI Studio Pro Chatbot running on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

export default app;
git add .
git commit -m "fix: make Vercel serverless functions self-contained to eliminate 500 module error"
git push
