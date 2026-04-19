import { randomUUID } from 'node:crypto';

export type CreateCollectionsCaseInput = {
  loanAccountId: string;
  customerId: string;
  reason: string;
  correlationId: string;
};

export type CreateCollectionsCaseResult = {
  caseId: string;
  status: 'NEW' | 'IN_REVIEW';
};

export interface WorkflowAdapter {
  createCollectionsCase(input: CreateCollectionsCaseInput): Promise<CreateCollectionsCaseResult>;
}

export class WorkflowAdapterStub implements WorkflowAdapter {
  public readonly requests: CreateCollectionsCaseInput[] = [];

  async createCollectionsCase(input: CreateCollectionsCaseInput): Promise<CreateCollectionsCaseResult> {
    this.requests.push(input);
    return {
      caseId: `collections-case-${randomUUID()}`,
      status: 'NEW'
    };
  }
}
