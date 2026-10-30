import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      error: 'GEMINI_API_KEY is not configured. Add it to Vercel project environment variables.',
    });
    return;
  }

  const {
    prompt,
    aspectRatio = '1:1',
    style = 'photorealistic',
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Prompt is required for image generation.' });
    return;
  }

  const cleanPrompt = prompt.trim();
  const styledPrompt = `${cleanPrompt}, ${style} style, high quality, highly detailed`;

  // Calculate dimensions
  let width = 1024;
  let height = 1024;
  if (aspectRatio === '16:9') { width = 1024; height = 576; }
  else if (aspectRatio === '9:16') { width = 576; height = 1024; }
  else if (aspectRatio === '4:3') { width = 1024; height = 768; }

  // Use Pollinations AI (no API key required, always works)
  try {
    const encodedPrompt = encodeURIComponent(styledPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

    res.status(200).json({
      imageUrl,
      prompt: cleanPrompt,
      aspectRatio,
      style,
      provider: 'Flux / Pollinations AI',
      createdAt: Date.now(),
    });
  } catch (err: unknown) {
    console.error('Image generation error:', err);
    res.status(500).json({ error: 'Failed to generate image. Please try again.' });
  }
}
