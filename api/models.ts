import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json([
    {
      id: 'auto',
      name: 'Auto (Smart Router)',
      badge: 'Intelligent',
      description: 'Automatically routes to the best model with instant failover protection',
      isFree: true,
      isDefault: true,
      isAuto: true,
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      badge: 'Flagship',
      description: 'High intelligence, multimodal vision analysis, deep reasoning & high speed',
      isFree: true,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      badge: 'High Speed',
      description: 'Ultra fast response time, low latency, ideal for conversation & coding',
      isFree: true,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      badge: 'Stable Free',
      description: 'Guaranteed 100% reliable free tier with zero throttling',
      isFree: true,
    },
  ]);
}
