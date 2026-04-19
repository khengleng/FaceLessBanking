import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { OnboardingWorkflowApplication } from '../application/onboarding-workflow.application.js';

export class OnboardingWorkflowConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly onboardingWorkflowApplication: OnboardingWorkflowApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeEkycStatusUpdated(async (event: unknown) => {
      await this.onboardingWorkflowApplication.processEkycStatusUpdated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
