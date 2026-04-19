export type ChatRequestDto = {
  message: string;
  context?: string;
};

export type SummarizeRequestDto = {
  text: string;
};

export type ClassifyRequestDto = {
  text: string;
  labels: string[];
};

export type AiResponseDto = {
  output: string;
  model: string;
};
