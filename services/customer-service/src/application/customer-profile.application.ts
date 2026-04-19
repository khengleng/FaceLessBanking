import { buildCustomerProfile, type CustomerProfile, type CustomerProfilePatch } from '../domain/customer-profile.js';
import type { PostgresCustomerAdapter } from '../adapters/postgres-customer.adapter.js';
import type { CustomerProfileEnrichmentMetrics } from '../events/metrics.js';

export type GetCustomerProfileResult =
  | { kind: 'found'; profile: CustomerProfile }
  | { kind: 'not_found' };

export type PatchCustomerProfileResult =
  | { kind: 'updated'; profile: CustomerProfile }
  | { kind: 'invalid_patch'; errors: string[] }
  | { kind: 'customer_not_found' };

export class CustomerProfileApplication {
  constructor(
    private readonly postgresAdapter: PostgresCustomerAdapter,
    private readonly metrics: CustomerProfileEnrichmentMetrics
  ) {}

  async getCustomerProfile(customerId: string): Promise<GetCustomerProfileResult> {
    const profile = await this.postgresAdapter.getCustomerProfile(customerId);
    if (!profile) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', profile };
  }

  async patchCustomerProfile(
    customerId: string,
    patch: CustomerProfilePatch
  ): Promise<PatchCustomerProfileResult> {
    const errors = validateProfilePatch(patch);
    if (errors.length > 0) {
      this.metrics.recordInvalidPatchAttempt();
      return { kind: 'invalid_patch', errors };
    }

    const customer = await this.postgresAdapter.findCustomerById(customerId);
    if (!customer) {
      return { kind: 'customer_not_found' };
    }

    const current = await this.postgresAdapter.getCustomerProfile(customerId);
    const now = new Date().toISOString();
    const next = buildCustomerProfile({
      customerId,
      displayName: patch.displayName ?? current?.displayName,
      onboardingReference: patch.onboardingReference ?? current?.onboardingReference ?? customer.onboardingReference,
      verificationStatus: patch.verificationStatus ?? current?.verificationStatus ?? 'UNVERIFIED',
      riskLevel: patch.riskLevel ?? current?.riskLevel ?? 'UNKNOWN',
      countryCode: patch.countryCode ?? current?.countryCode,
      contactStatus: patch.contactStatus ?? current?.contactStatus ?? 'UNKNOWN',
      createdAt: current?.createdAt ?? now,
      updatedAt: now
    });

    await this.postgresAdapter.upsertCustomerProfile(next);
    return { kind: 'updated', profile: next };
  }
}

function validateProfilePatch(patch: CustomerProfilePatch): string[] {
  const errors: string[] = [];

  if (patch.displayName !== undefined && patch.displayName.trim().length < 2) {
    errors.push('displayName must contain at least 2 characters');
  }

  if (
    patch.verificationStatus !== undefined
    && !['UNVERIFIED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ON_HOLD'].includes(patch.verificationStatus)
  ) {
    errors.push('verificationStatus is invalid');
  }

  if (patch.riskLevel !== undefined && !['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'].includes(patch.riskLevel)) {
    errors.push('riskLevel is invalid');
  }

  if (patch.countryCode !== undefined && patch.countryCode.trim().length !== 2) {
    errors.push('countryCode must be an ISO-3166 alpha-2 code');
  }

  if (patch.contactStatus !== undefined && !['UNCONFIRMED', 'CONFIRMED', 'UNKNOWN'].includes(patch.contactStatus)) {
    errors.push('contactStatus is invalid');
  }

  return errors;
}
