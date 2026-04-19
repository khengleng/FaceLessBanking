export type CaseEventPayload = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export class KafkaProducerAdapter {
  public readonly events: CaseEventPayload[] = [];

  async publish(event: CaseEventPayload): Promise<void> {
    this.events.push(event);
  }
}
