export type PublishedEvent = {
  topic: string;
  payload: Record<string, string>;
};

export class KafkaProducerAdapter {
  public readonly events: PublishedEvent[] = [];

  async publish(topic: string, payload: Record<string, string>): Promise<void> {
    this.events.push({ topic, payload });
  }
}
