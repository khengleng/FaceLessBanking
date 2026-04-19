export type KafkaMessage = {
  topic: string;
  payload: Record<string, string>;
};

export class KafkaConsumerAdapter {
  public readonly subscriptions: string[] = [];

  async subscribe(topic: string): Promise<void> {
    this.subscriptions.push(topic);
  }

  async handleMessage(message: KafkaMessage): Promise<void> {
    void message;
    // Placeholder for asynchronous ledger status updates.
  }
}
