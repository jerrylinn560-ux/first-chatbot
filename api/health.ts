import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  res.status(200).json({
    status: 'healthy',
    configured: Boolean(apiKey && apiKey.length > 10),
    defaultModel: 'gemini-2.0-flash',
    timestamp: Date.now(),
  });
}
