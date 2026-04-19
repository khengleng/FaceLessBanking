export type LivenessRequest = {
  sessionId: string;
  selfieReference: string;
  challengeToken: string;
};

export type LivenessResult = {
  status: 'passed';
};

export interface LivenessProviderAdapter {
  verifyLiveness(request: LivenessRequest): Promise<LivenessResult>;
}

export class LivenessProviderAdapterStub implements LivenessProviderAdapter {
  async verifyLiveness(request: LivenessRequest): Promise<LivenessResult> {
    void request;
    return { status: 'passed' };
  }
}
