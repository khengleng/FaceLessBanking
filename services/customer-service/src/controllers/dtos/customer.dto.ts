import { z } from 'zod';
import type { Customer } from '../../domain/customer.js';
import type { CustomerProfile } from '../../domain/customer-profile.js';

export const CreateCustomerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export type CreateCustomerRequestDto = z.infer<typeof CreateCustomerSchema>;

export type CustomerResponseDto = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
};

export type ListCustomersQueryDto = {
  customerId?: string;
  onboardingReference?: string;
  limit?: number;
  offset?: number;
};

export type CustomerProfileResponseDto = {
  customerId: string;
  displayName?: string;
  onboardingReference?: string;
  verificationStatus: CustomerProfile['verificationStatus'];
  riskLevel: CustomerProfile['riskLevel'];
  countryCode?: string;
  contactStatus: CustomerProfile['contactStatus'];
  createdAt: string;
  updatedAt: string;
};

export type PatchCustomerProfileRequestDto = {
  displayName?: string;
  onboardingReference?: string;
  verificationStatus?: CustomerProfile['verificationStatus'];
  riskLevel?: CustomerProfile['riskLevel'];
  countryCode?: string;
  contactStatus?: CustomerProfile['contactStatus'];
};

export function toCustomerResponseDto(customer: Customer): CustomerResponseDto {
  return {
    customerId: customer.customerId,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    status: customer.status,
    createdAt: customer.createdAt
  };
}

export function toCustomerProfileResponseDto(profile: CustomerProfile): CustomerProfileResponseDto {
  return {
    customerId: profile.customerId,
    displayName: profile.displayName,
    onboardingReference: profile.onboardingReference,
    verificationStatus: profile.verificationStatus,
    riskLevel: profile.riskLevel,
    countryCode: profile.countryCode,
    contactStatus: profile.contactStatus,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}
