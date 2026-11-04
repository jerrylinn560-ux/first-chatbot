import type { VercelRequest, VercelResponse } from '@vercel/node';

export const UI_MODEL_LIST = [
  {
    id: 'auto',
    name: 'Auto (Smart Router)',
    badge: 'Intelligent',
    description: 'Automatically routes to the best model with instant 503 failover',
    isFree: true,
    isDefault: true,
    isAuto: true,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Fast & Stable',
    description: 'High throughput, low latency, balanced intelligence & reliable availability',
    isFree: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship',
    description: 'Next-gen multimodal reasoning, vision, code synthesis & deep thought',
    isFree: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Fastest response time, minimal latency, ideal for conversation & quick answers',
    isFree: true,
  },
];

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');

  if (_req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json(UI_MODEL_LIST);
}
