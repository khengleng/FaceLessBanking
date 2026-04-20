import { createEventBackboneConsumer, type EventBackboneConsumer } from '@faceless-banking/shared-events';

type EkycApprovedHandler = (event: unknown) => Promise<void>;
type OnboardingCaseApprovedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private ekycApprovedHandler: EkycApprovedHandler | null = null;
  private onboardingCaseApprovedHandler: OnboardingCaseApprovedHandler | null = null;

  constructor() {
    const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS?.split(',') ?? [];
    this.consumer = createEventBackboneConsumer({
      consumer: 'customer-service-consumer',
      groupId: 'customer-service-group',
      brokers,
      retry: { maxAttempts: 3 },
      dlq: { topic: 'customer-service.consumer.dlq', enabled: true }
    });
  }

  async subscribeEkycStatusUpdated(handler: EkycApprovedHandler): Promise<void> {
    this.ekycApprovedHandler = handler;
    await this.consumer.subscribe(['ekyc.status.updated.v1']);
  }

  async subscribeCaseActionRecorded(handler: OnboardingCaseApprovedHandler): Promise<void> {
    this.onboardingCaseApprovedHandler = handler;
    await this.consumer.subscribe(['case.action.recorded.v1']);
  }

  async start(): Promise<void> {
    await this.consumer.start(async (event) => {
      switch (event.type) {
        case 'ekyc.status.updated.v1':
          if (this.ekycApprovedHandler) {
            await this.ekycApprovedHandler(event);
          }
          break;
        case 'case.action.recorded.v1':
          if (this.onboardingCaseApprovedHandler) {
            await this.onboardingCaseApprovedHandler(event);
          }
          break;
        default:
          console.warn(`Customer service received unhandled event type: ${event.type}`);
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
