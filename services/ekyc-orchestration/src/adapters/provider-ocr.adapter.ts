export type OcrRequest = {
  sessionId: string;
  documentType: string;
  fileReference: string;
};

export type OcrResult = {
  status: 'passed';
};

export interface OcrProviderAdapter {
  processDocument(request: OcrRequest): Promise<OcrResult>;
}

export class OcrProviderAdapterStub implements OcrProviderAdapter {
  async processDocument(request: OcrRequest): Promise<OcrResult> {
    void request;
    return { status: 'passed' };
  }
}
