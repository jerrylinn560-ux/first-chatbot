import { ModelOption } from '../../types/chat';
import {
  UI_MODEL_LIST,
  classifyPromptTask as serviceClassify,
  resolveAutoModel as serviceResolveAuto,
  TaskCategory as ServiceTaskCategory,
} from './ai-service';

export const ALL_MODELS: ModelOption[] = UI_MODEL_LIST;

export type TaskCategory = ServiceTaskCategory;

export function classifyPromptTask(prompt: string, hasImageAttachment = false): TaskCategory {
  return serviceClassify(prompt, hasImageAttachment);
}

export function resolveAutoModel(prompt: string, hasImage = false): string {
  return serviceResolveAuto(prompt, hasImage);
}
