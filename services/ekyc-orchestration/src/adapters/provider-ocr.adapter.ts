export type OcrRequest = {
  sessionId: string;
  documentType: string;
  fileReference: string;
};

export type OcrResult = {
  status: 'passed' | 'failed';
  details?: string;
};

export interface OcrProviderAdapter {
  processDocument(request: OcrRequest): Promise<OcrResult>;
}

/**
 * DETERMINISTIC STUB for OCR.
 * Marked as PLACEHOLDER.
 * Logic: fails if documentType is 'invalid_doc', else passes.
 */
export class OcrProviderAdapterStub implements OcrProviderAdapter {
  async processDocument(request: OcrRequest): Promise<OcrResult> {
    if (request.documentType === 'invalid_doc') {
      return { status: 'failed', details: 'DETERMINISTIC_STUB_FAILURE: invalid_doc' };
    }
    return { status: 'passed' };
  }
}
