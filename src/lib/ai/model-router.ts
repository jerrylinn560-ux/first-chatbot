import { ModelOption } from '../../types/chat';

export const ALL_MODELS: ModelOption[] = [
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
];

export type TaskCategory = 'general' | 'vision' | 'reasoning' | 'fast';

/**
 * Classify user prompt to understand task type
 */
export function classifyPromptTask(prompt: string, hasImageAttachment = false): TaskCategory {
  if (hasImageAttachment) return 'vision';
  const lower = prompt.toLowerCase();
  if (
    lower.includes('code') ||
    lower.includes('function') ||
    lower.includes('class') ||
    lower.includes('bug') ||
    lower.includes('algorithm') ||
    lower.includes('refactor') ||
    lower.includes('typescript') ||
    lower.includes('python') ||
    lower.includes('solve') ||
    lower.includes('derive') ||
    lower.includes('proof') ||
    lower.includes('calculate')
  ) {
    return 'reasoning';
  }
  return 'general';
}

/**
 * Resolves to gemini-3.8-flash as the primary flagship model with automatic backend fallback
 */
export function resolveAutoModel(_prompt: string, _hasImage = false): string {
  return 'gemini-3.8-flash';
}
