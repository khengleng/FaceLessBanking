import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { OnboardingCustomerCreationApplication } from '../application/onboarding-customer-creation.application.js';

export class OnboardingApprovedConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly onboardingApplication: OnboardingCustomerCreationApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeEkycStatusUpdated(async (event: unknown) => {
      await this.onboardingApplication.processEkycStatusUpdated(event);
    });

    await this.kafkaConsumer.subscribeCaseActionRecorded(async (event: unknown) => {
      await this.onboardingApplication.processCaseActionRecorded(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
