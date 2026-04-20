import pg from 'pg';
const { Pool } = pg;

import type { FeeRule, FeeRuleType, FeeRuleStatus } from '../domain/fee-rule.js';
import type { FeeAssessment, FeeAssessmentStatus } from '../domain/fee-assessment.js';

export class PostgresFeeAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async createFeeRule(rule: FeeRule): Promise<void> {
    const query = `
      INSERT INTO fee_rules (
        rule_id, rule_type, trigger_event_type, fixed_amount_cents, 
        percentage, currency, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (rule_id) DO NOTHING;
    `;
    const values = [
      rule.ruleId,
      rule.ruleType,
      rule.triggerEventType,
      rule.fixedAmountCents ?? null,
      rule.percentage ?? null,
      rule.currency,
      rule.status,
      rule.createdAt
    ];
    await this.pool.query(query, values);
  }

  async getFeeRuleById(ruleId: string): Promise<FeeRule | null> {
    const query = 'SELECT * FROM fee_rules WHERE rule_id = $1';
    const { rows } = await this.pool.query(query, [ruleId]);
    return rows.length > 0 ? this.mapRowToFeeRule(rows[0]) : null;
  }

  async findApplicableFeeRules(eventType: string): Promise<FeeRule[]> {
    const query = 'SELECT * FROM fee_rules WHERE trigger_event_type = $1 AND status = $2';
    const { rows } = await this.pool.query(query, [eventType, 'ACTIVE']);
    return rows.map(row => this.mapRowToFeeRule(row));
  }

  async hasProcessedFeeEvent(sourceEventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_events WHERE event_id = $1 AND event_type = $2';
    const { rows } = await this.pool.query(query, [sourceEventId, 'FEE_EVENT']);
    return rows.length > 0;
  }

  async markFeeEventProcessed(sourceEventId: string): Promise<void> {
    const query = 'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [sourceEventId, 'FEE_EVENT']);
  }

  async createFeeAssessment(assessment: FeeAssessment): Promise<void> {
    const query = `
      INSERT INTO fee_assessments (
        assessment_id, source_event_id, source_entity_type, source_entity_id, 
        customer_id, rule_id, assessed_amount_cents, currency, status, 
        payment_id, failure_reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (assessment_id) DO NOTHING;
    `;
    const values = [
      assessment.assessmentId,
      assessment.sourceEventId,
      assessment.sourceEntityType,
      assessment.sourceEntityId,
      assessment.customerId,
      assessment.ruleId,
      assessment.assessedAmountCents,
      assessment.currency,
      assessment.status,
      assessment.paymentId ?? null,
      assessment.failureReason ?? null,
      assessment.createdAt,
      assessment.updatedAt
    ];
    await this.pool.query(query, values);
  }

  async getFeeAssessment(assessmentId: string): Promise<FeeAssessment | null> {
    const query = 'SELECT * FROM fee_assessments WHERE assessment_id = $1';
    const { rows } = await this.pool.query(query, [assessmentId]);
    return rows.length > 0 ? this.mapRowToFeeAssessment(rows[0]) : null;
  }

  async updateFeeStatus(
    assessmentId: string, 
    status: FeeAssessment['status'], 
    paymentId?: string,
    failureReason?: string
  ): Promise<void> {
    const query = `
      UPDATE fee_assessments 
      SET status = $1, payment_id = COALESCE($2, payment_id), 
          failure_reason = COALESCE($3, failure_reason), updated_at = $4 
      WHERE assessment_id = $5
    `;
    const values = [
      status,
      paymentId ?? null,
      failureReason ?? null,
      new Date().toISOString(),
      assessmentId
    ];
    await this.pool.query(query, values);
  }

  private mapRowToFeeRule(row: any): FeeRule {
    return {
      ruleId: row.rule_id,
      ruleType: row.rule_type as FeeRuleType,
      triggerEventType: row.trigger_event_type,
      fixedAmountCents: row.fixed_amount_cents ? parseInt(row.fixed_amount_cents, 10) : undefined,
      percentage: row.percentage ? parseFloat(row.percentage) : undefined,
      currency: row.currency,
      status: row.status as FeeRuleStatus,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }

  private mapRowToFeeAssessment(row: any): FeeAssessment {
    return {
      assessmentId: row.assessment_id,
      sourceEventId: row.source_event_id,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      customerId: row.customer_id,
      ruleId: row.rule_id,
      assessedAmountCents: parseInt(row.assessed_amount_cents, 10),
      currency: row.currency,
      status: row.status as FeeAssessmentStatus,
      paymentId: row.payment_id ?? undefined,
      failureReason: row.failure_reason ?? undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
