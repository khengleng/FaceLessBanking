import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

type PaymentStatusUpdatedHandler = (event: unknown) => Promise<void>;
type EkycStatusUpdatedHandler = (event: unknown) => Promise<void>;
type CaseActionRecordedHandler = (event: unknown) => Promise<void>;
type NotificationRequestedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private paymentStatusUpdatedHandler: PaymentStatusUpdatedHandler | null = null;
  private ekycStatusUpdatedHandler: EkycStatusUpdatedHandler | null = null;
  private caseActionRecordedHandler: CaseActionRecordedHandler | null = null;
  private notificationRequestedHandler: NotificationRequestedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'notification-service-consumer',
      groupId: 'notification-service-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'notification-service.consumer.dlq', enabled: true }
    });
  }

  async subscribePaymentStatusUpdated(handler: PaymentStatusUpdatedHandler): Promise<void> {
    this.paymentStatusUpdatedHandler = handler;
    await this.consumer.subscribe(['payment.status.updated.v1']);
  }

  async subscribeEkycStatusUpdated(handler: EkycStatusUpdatedHandler): Promise<void> {
    this.ekycStatusUpdatedHandler = handler;
    await this.consumer.subscribe(['ekyc.status.updated.v1']);
  }

  async subscribeCaseActionRecorded(handler: CaseActionRecordedHandler): Promise<void> {
    this.caseActionRecordedHandler = handler;
    await this.consumer.subscribe(['case.action.recorded.v1']);
  }

  async subscribeNotificationRequested(handler: NotificationRequestedHandler): Promise<void> {
    this.notificationRequestedHandler = handler;
    await this.consumer.subscribe(['notification.requested.v1']);
  }

  async handlePaymentStatusUpdated(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.paymentStatusUpdatedHandler) {
      return;
    }

    await this.paymentStatusUpdatedHandler(event);
  }

  async handleEkycStatusUpdated(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.ekycStatusUpdatedHandler) {
      return;
    }

    await this.ekycStatusUpdatedHandler(event);
  }

  async handleCaseActionRecorded(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.caseActionRecordedHandler) {
      return;
    }

    await this.caseActionRecordedHandler(event);
  }

  async handleNotificationRequested(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.notificationRequestedHandler) {
      return;
    }

    await this.notificationRequestedHandler(event);
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
