import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  if (_req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'production';
  const configured = Boolean(apiKey && apiKey.length > 8);

  const report = {
    status: configured ? 'healthy' : 'unconfigured',
    environment,
    isVercel,
    configured,
    apiConnectivity: 'disconnected' as 'connected' | 'unauthenticated' | 'billing_error' | 'disconnected',
    availableModels: ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    testedModel: {
      id: 'gemini-3.5-flash',
      status: 'error' as 'ok' | 'error',
      latencyMs: 0,
      error: undefined as string | undefined,
    },
    timestamp: Date.now(),
  };

  if (!configured) {
    res.status(503).json(report);
    return;
  }

  const start = Date.now();
  try {
    const client = new GoogleGenAI({ apiKey });
    const pingRes = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'ping',
    });

    if (pingRes && pingRes.text !== undefined) {
      report.apiConnectivity = 'connected';
      report.status = 'healthy';
      report.testedModel = {
        id: 'gemini-3.5-flash',
        status: 'ok',
        latencyMs: Date.now() - start,
        error: undefined,
      };
    }
  } catch (err: any) {
    const msg = (err?.message || String(err || '')).toLowerCase();
    report.testedModel = {
      id: 'gemini-3.5-flash',
      status: 'error',
      latencyMs: Date.now() - start,
      error: err?.message || 'Upstream ping failed',
    };

    if (msg.includes('api_key') || msg.includes('unauthenticated')) {
      report.apiConnectivity = 'unauthenticated';
      report.status = 'unhealthy';
    } else if (msg.includes('billing') || msg.includes('payment')) {
      report.apiConnectivity = 'billing_error';
      report.status = 'degraded';
    } else {
      report.apiConnectivity = 'disconnected';
      report.status = 'unhealthy';
    }
  }

  const statusCode = report.status === 'healthy' ? 200 : report.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(report);
}
