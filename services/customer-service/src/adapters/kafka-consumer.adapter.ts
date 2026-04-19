import { createEventBackboneConsumer, type EventBackboneConsumer } from '@faceless-banking/shared-events';

type EkycApprovedHandler = (event: unknown) => Promise<void>;
type OnboardingCaseApprovedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private ekycApprovedHandler: EkycApprovedHandler | null = null;
  private onboardingCaseApprovedHandler: OnboardingCaseApprovedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'customer-service-consumer',
      groupId: 'customer-service-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'customer-service.consumer.dlq', enabled: true }
    });
  }

  async subscribePlaceholder(topics: string[]): Promise<void> {
    await this.consumer.subscribe(topics);
  }

  async subscribeEkycStatusUpdated(handler: EkycApprovedHandler): Promise<void> {
    this.ekycApprovedHandler = handler;
    await this.consumer.subscribe(['ekyc.status.updated.v1']);
  }

  async subscribeCaseActionRecorded(handler: OnboardingCaseApprovedHandler): Promise<void> {
    this.onboardingCaseApprovedHandler = handler;
    await this.consumer.subscribe(['case.action.recorded.v1']);
  }

  async handleEkycStatusUpdated(event: unknown): Promise<void> {
    if (!this.ekycApprovedHandler) {
      return;
    }

    await this.ekycApprovedHandler(event);
  }

  async handleCaseActionRecorded(event: unknown): Promise<void> {
    if (!this.onboardingCaseApprovedHandler) {
      return;
    }

    await this.onboardingCaseApprovedHandler(event);
  }

  async startPlaceholder(): Promise<void> {
    await this.consumer.start();
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
