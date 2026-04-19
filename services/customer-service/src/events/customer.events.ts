import { randomUUID } from 'node:crypto';

import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { Customer } from '../domain/customer.js';
import type { CustomerProfile } from '../domain/customer-profile.js';

export class CustomerEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitCustomerCreated(customer: Customer): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'customer.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: `customer-${customer.customerId}`,
        causationId: `customer-created-${customer.customerId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        customerId: customer.customerId,
        email: customer.email,
        status: customer.status
      }
    });
  }

  async emitCustomerCreatedFromOnboarding(input: {
    customer: Customer;
    correlationId: string;
    sourceEventId: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'customer.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.sourceEventId,
        timestamp: new Date().toISOString()
      },
      payload: {
        customerId: input.customer.customerId,
        onboardingReference: input.customer.onboardingReference ?? input.customer.sourceEntityId,
        sourceEventId: input.sourceEventId,
        status: input.customer.status
      }
    });
  }

  async emitCustomerProfileEnriched(input: {
    profile: CustomerProfile;
    correlationId: string;
    sourceEventId: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'customer.profile.enriched.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.sourceEventId,
        timestamp: new Date().toISOString()
      },
      payload: {
        customerId: input.profile.customerId,
        sourceEventId: input.sourceEventId,
        verificationStatus: input.profile.verificationStatus,
        onboardingReference: input.profile.onboardingReference,
        timestamp: new Date().toISOString()
      }
    });
  }
}
