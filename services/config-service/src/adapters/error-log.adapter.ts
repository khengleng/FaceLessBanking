export type RuntimeErrorRecord = {
  errorId: string;
  message: string;
  path: string;
  method: string;
  timestamp: string;
};

export class InMemoryErrorLogAdapter {
  private readonly errors: RuntimeErrorRecord[] = [];

  async addError(error: RuntimeErrorRecord): Promise<void> {
    this.errors.push(structuredClone(error));
  }

  async listErrors(): Promise<RuntimeErrorRecord[]> {
    return this.errors.map((entry) => structuredClone(entry));
  }
}

