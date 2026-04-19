export type AiAction = 'chat' | 'summarize' | 'classify';

export type PromptPolicy = {
  blockedKeywords: string[];
  maxInputLength: number;
};

export const defaultPromptPolicy: PromptPolicy = {
  blockedKeywords: ['transfer money', 'send payment', 'move funds', 'wire transfer'],
  maxInputLength: 4000
};
