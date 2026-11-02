import type { VercelRequest, VercelResponse } from '@vercel/node';

// Catch-all fallback for unmatched API routes.
// Specific routes are handled by api/chat.ts, api/models.ts, api/health.ts, api/images/generate.ts
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.url}`,
    availableEndpoints: [
      'POST /api/chat',
      'GET /api/models',
      'GET /api/health',
      'POST /api/images/generate',
    ],
  });
}
