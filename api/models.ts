import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json([
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
      name: 'Gemini Flash Lite',
      badge: 'Ultra Fast',
      description: 'Fastest response time, low latency, ideal for conversation & quick answers',
      isFree: true,
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini Flash',
      badge: 'Flagship',
      description: 'High intelligence, multimodal vision analysis, and creative synthesis',
      isFree: true,
    },
    {
      id: 'gemini-4-argon',
      name: 'Gemini Pro',
      badge: 'Deep Reasoning',
      description: 'Advanced mathematical logic, complex STEM, and deep coding architecture',
      isFree: false,
    },
  ]);
}
