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
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Fastest response time, low latency, ideal for conversation & quick answers',
    isFree: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship',
    description: 'High intelligence, multimodal vision analysis, and creative synthesis',
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

export type TaskCategory =
  | 'math_logic'
  | 'coding'
  | 'creative'
  | 'multimodal'
  | 'general';

/**
 * Classifies prompt intent to intelligently route to the optimal model
 */
export function classifyPromptTask(prompt: string, hasImageAttachment = false): TaskCategory {
  if (hasImageAttachment) {
    return 'multimodal';
  }

  const p = prompt.toLowerCase();

  // Math, logic, algorithms, proofs
  if (
    /\b(math|calculus|equation|derivative|integral|matrix|theorem|proof|algorithm|probability|linear algebra|physics|solve for x|quadratic)\b/i.test(
      p
    ) ||
    /(\d+[\+\-\*\/\^]\d+.*=|\bcalculate\b|\bderive\b)/i.test(p)
  ) {
    return 'math_logic';
  }

  // Deep coding / complex software engineering
  if (
    /\b(refactor|optimize algorithm|memory leak|architecture|system design|concurrency|deadlock|dockerfile|kubernetes|sql join|binary tree|dynamic programming|compiler)\b/i.test(
      p
    ) ||
    /```[\s\S]*```/.test(prompt)
  ) {
    return 'coding';
  }

  // Creative writing, story, poetry
  if (
    /\b(story|poem|novel|script|lyrics|creative writing|character design|plot twist|fiction|fantasy)\b/i.test(
      p
    )
  ) {
    return 'creative';
  }

  return 'general';
}

/**
 * Resolves the actual model name to call when 'auto' routing is selected
 */
export function resolveAutoModel(prompt: string, hasImage = false): string {
  const task = classifyPromptTask(prompt, hasImage);

  switch (task) {
    case 'math_logic':
    case 'coding':
      // For deep reasoning, use preview flash or fallback to standard flash
      return 'gemini-2.5-flash-preview-05-20';
    case 'creative':
    case 'multimodal':
      return 'gemini-2.0-flash';
    case 'general':
    default:
      // Default to fastest low-latency model for regular conversation
      return 'gemini-2.0-flash-lite';
  }
}
