import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { OnboardingNotificationTriggerApplication } from '../application/onboarding-notification-trigger.application.js';

export class OnboardingStatusConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly triggerApplication: OnboardingNotificationTriggerApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeEkycStatusUpdated(async (event: unknown) => {
      await this.triggerApplication.processEkycStatusUpdated(event);
    });

    await this.kafkaConsumer.subscribeCaseActionRecorded(async (event: unknown) => {
      await this.triggerApplication.processCaseActionRecorded(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
