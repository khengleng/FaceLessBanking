import pg from 'pg';
const { Pool } = pg;

import type { RuleCategory, RuleDefinition } from '../domain/rule-definition.js';

export class PostgresRulesAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async insertRuleDefinition(definition: RuleDefinition): Promise<void> {
    const query = `
      INSERT INTO rule_definitions (
        rule_id, category, name, config, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (rule_id) DO UPDATE SET
        name = EXCLUDED.name,
        config = EXCLUDED.config,
        updated_at = EXCLUDED.updated_at;
    `;
    const values = [
      definition.ruleId,
      definition.category,
      definition.name,
      JSON.stringify(definition.config),
      definition.createdAt,
      definition.updatedAt
    ];
    await this.pool.query(query, values);
  }

  async findRuleDefinitionById(ruleId: string): Promise<RuleDefinition | null> {
    const query = 'SELECT * FROM rule_definitions WHERE rule_id = $1';
    const { rows } = await this.pool.query(query, [ruleId]);
    return rows.length > 0 ? this.mapRowToRule(rows[0]) : null;
  }

  async findLatestRuleDefinitionByCategory(category: RuleCategory): Promise<RuleDefinition | null> {
    const query = 'SELECT * FROM rule_definitions WHERE category = $1 ORDER BY created_at DESC LIMIT 1';
    const { rows } = await this.pool.query(query, [category]);
    return rows.length > 0 ? this.mapRowToRule(rows[0]) : null;
  }

  private mapRowToRule(row: any): RuleDefinition {
    return {
      ruleId: row.rule_id,
      category: row.category as RuleCategory,
      name: row.name,
      config: row.config,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
