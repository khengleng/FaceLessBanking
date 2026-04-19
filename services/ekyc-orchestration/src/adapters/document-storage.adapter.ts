export type DocumentStorageRequest = {
  sessionId: string;
  type: string;
  fileReference: string;
};

export interface DocumentStorageAdapter {
  storeDocument(request: DocumentStorageRequest): Promise<string>;
}

export class DocumentStorageAdapterStub implements DocumentStorageAdapter {
  async storeDocument(request: DocumentStorageRequest): Promise<string> {
    return `doc-${request.sessionId}-${request.type}`;
  }
}
