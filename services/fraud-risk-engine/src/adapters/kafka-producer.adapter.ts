export type RiskEventPayload = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export class KafkaProducerAdapter {
  public readonly events: RiskEventPayload[] = [];

  async publish(event: RiskEventPayload): Promise<void> {
    this.events.push(event);
  }
}
