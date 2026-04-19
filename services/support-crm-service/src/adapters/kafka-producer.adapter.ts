export type SupportEventPayload = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export class KafkaProducerAdapter {
  public readonly events: SupportEventPayload[] = [];

  async publish(event: SupportEventPayload): Promise<void> {
    this.events.push(event);
  }
}
