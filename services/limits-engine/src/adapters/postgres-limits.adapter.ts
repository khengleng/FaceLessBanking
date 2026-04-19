import type { LimitRule, LimitUsage } from '../domain/limits.js';

export class PostgresLimitsAdapter {
  private readonly rules = new Map<string, LimitRule>();
  private readonly usages = new Map<string, LimitUsage>();

  async getLimitRules(entityType: string, entityId: string): Promise<LimitRule[]> {
    return Array.from(this.rules.values()).filter(
      (r) => r.status === 'ACTIVE' && 
      (r.entityType === entityType) && 
      (r.entityId === 'ALL' || r.entityId === entityId)
    );
  }

  async getRuleById(ruleId: string): Promise<LimitRule | null> {
    return this.rules.get(ruleId) ?? null;
  }

  async saveLimitRule(rule: LimitRule): Promise<void> {
    this.rules.set(rule.ruleId, rule);
  }

  async getUsage(ruleId: string, entityId: string, periodKey: string): Promise<LimitUsage | null> {
    const key = `${ruleId}:${entityId}:${periodKey}`;
    return this.usages.get(key) ?? null;
  }

  async updateUsage(usage: LimitUsage): Promise<void> {
    const key = `${usage.ruleId}:${usage.entityId}:${usage.periodKey}`;
    this.usages.set(key, { ...usage, updatedAt: new Date().toISOString() });
  }
}
