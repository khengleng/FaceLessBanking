import type { Customer360View } from '../domain/customer-360.js';

export class Customer360EventsAdapter {
  async emitCustomer360Viewed(payload: Customer360View): Promise<void> {
    void payload;
    // Placeholder for future customer.360.viewed.v1
  }
}
