export interface WorkflowAdapter {
  createApprovalCase(params: {
    customerId: string;
    ruleId: string;
    amountCents: bigint;
    currency: string;
    type: string;
  }): Promise<{ caseId: string }>;
}

export class WorkflowAdapterStub implements WorkflowAdapter {
  async createApprovalCase(params: {
    customerId: string;
    ruleId: string;
    amountCents: bigint;
    currency: string;
    type: string;
  }): Promise<{ caseId: string }> {
    console.log('Creating limit override approval case', params);
    return { caseId: `case_limit_${Date.now()}` };
  }
}
