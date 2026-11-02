import { ModelOption } from '../../types/chat';

export const ALL_MODELS: ModelOption[] = [
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
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship',
    description: 'High intelligence, multimodal vision analysis, deep reasoning, and high speed',
    isFree: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Fastest response time, low latency, ideal for conversation & quick answers',
    isFree: true,
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    badge: 'Deep Reasoning',
    description: 'Advanced mathematical logic, complex STEM, and deep coding architecture',
    isFree: false,
  },
];

export type TaskCategory = 'general' | 'vision' | 'reasoning' | 'fast';

/**
 * Classify user prompt to choose the optimal Gemini model
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
  if (prompt.length < 80) {
    return 'fast';
  }
  return 'general';
}

/**
 * Resolves the optimal Gemini model ID based on the prompt task
 */
export function resolveAutoModel(prompt: string, hasImage = false): string {
  const category = classifyPromptTask(prompt, hasImage);
  switch (category) {
    case 'vision':
    case 'reasoning':
      return 'gemini-3.8-flash';
    case 'fast':
      return 'gemini-3.1-flash-lite';
    case 'general':
    default:
      return 'gemini-3.8-flash';
  }
}
