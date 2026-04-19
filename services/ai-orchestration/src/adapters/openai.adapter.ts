export type OpenAiChatRequest = {
  message: string;
  context?: string;
};

export type OpenAiSummarizeRequest = {
  text: string;
};

export type OpenAiClassifyRequest = {
  text: string;
  labels: string[];
};

export interface OpenAiAdapter {
  chat(request: OpenAiChatRequest): Promise<string>;
  summarize(request: OpenAiSummarizeRequest): Promise<string>;
  classify(request: OpenAiClassifyRequest): Promise<string>;
}

export class OpenAiAdapterStub implements OpenAiAdapter {
  async chat(request: OpenAiChatRequest): Promise<string> {
    return `Stubbed assistant response to: ${request.message.slice(0, 80)}`;
  }

  async summarize(request: OpenAiSummarizeRequest): Promise<string> {
    return `Stub summary: ${request.text.slice(0, 120)}`;
  }

  async classify(request: OpenAiClassifyRequest): Promise<string> {
    const primary = request.labels[0] ?? 'unclassified';
    return `Stub classification: ${primary}`;
  }
}
