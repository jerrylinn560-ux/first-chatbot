import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UI_MODEL_LIST } from '../src/lib/ai/ai-service';

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
