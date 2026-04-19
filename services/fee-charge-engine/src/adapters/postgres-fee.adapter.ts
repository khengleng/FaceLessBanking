import type { FeeRule } from '../domain/fee-rule.js';
import type { FeeAssessment } from '../domain/fee-assessment.js';

export class PostgresFeeAdapter {
  private readonly rules = new Map<string, FeeRule>();
  private readonly assessments = new Map<string, FeeAssessment>();
  private readonly processedEvents = new Set<string>();

  async createFeeRule(rule: FeeRule): Promise<void> {
    this.rules.set(rule.ruleId, rule);
  }

  async getFeeRuleById(ruleId: string): Promise<FeeRule | null> {
    return this.rules.get(ruleId) ?? null;
  }

  async findApplicableFeeRules(eventType: string): Promise<FeeRule[]> {
    return Array.from(this.rules.values()).filter(
      (r) => r.triggerEventType === eventType && r.status === 'ACTIVE'
    );
  }

  async hasProcessedFeeEvent(sourceEventId: string): Promise<boolean> {
    return this.processedEvents.has(sourceEventId);
  }

  async markFeeEventProcessed(sourceEventId: string): Promise<void> {
    this.processedEvents.add(sourceEventId);
  }

  async createFeeAssessment(assessment: FeeAssessment): Promise<void> {
    this.assessments.set(assessment.assessmentId, assessment);
  }

  async getFeeAssessment(assessmentId: string): Promise<FeeAssessment | null> {
    return this.assessments.get(assessmentId) ?? null;
  }

  async updateFeeStatus(
    assessmentId: string, 
    status: FeeAssessment['status'], 
    paymentId?: string,
    failureReason?: string
  ): Promise<void> {
    const assessment = this.assessments.get(assessmentId);
    if (assessment) {
      this.assessments.set(assessmentId, {
        ...assessment,
        status,
        paymentId: paymentId ?? assessment.paymentId,
        failureReason: failureReason ?? assessment.failureReason,
        updatedAt: new Date().toISOString()
      });
    }
  }
}
