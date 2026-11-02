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
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      badge: 'Ultra Fast',
      description: 'Fastest response time, ultra-low latency, ideal for conversation & quick answers',
      isFree: true,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      badge: 'Fast & Smart',
      description: 'Fast, multimodal, excellent for general tasks and image understanding',
      isFree: true,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      badge: 'Flagship',
      description: 'High intelligence, advanced reasoning, multimodal vision analysis, and creative synthesis',
      isFree: true,
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      badge: 'Deep Reasoning',
      description: 'Most intelligent model — advanced mathematical logic, complex STEM, deep coding architecture',
      isFree: false,
    },
  ]);
}
