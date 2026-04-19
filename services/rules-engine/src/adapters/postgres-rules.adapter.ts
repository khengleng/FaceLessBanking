import type { RuleCategory, RuleDefinition } from '../domain/rule-definition.js';

export class PostgresRulesAdapter {
  private readonly definitionsById = new Map<string, RuleDefinition>();

  private readonly definitionsByCategory = new Map<RuleCategory, RuleDefinition[]>();

  async insertRuleDefinition(definition: RuleDefinition): Promise<void> {
    this.definitionsById.set(definition.ruleId, definition);

    const existing = this.definitionsByCategory.get(definition.category) ?? [];
    this.definitionsByCategory.set(definition.category, [...existing, definition]);
  }

  async findRuleDefinitionById(ruleId: string): Promise<RuleDefinition | null> {
    return this.definitionsById.get(ruleId) ?? null;
  }

  async findLatestRuleDefinitionByCategory(category: RuleCategory): Promise<RuleDefinition | null> {
    const definitions = this.definitionsByCategory.get(category) ?? [];
    return definitions[definitions.length - 1] ?? null;
  }
}
