export type CustomerStatus = 'pending_kyc' | 'ACTIVE' | 'VERIFIED';

export type Customer = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  onboardingReference?: string;
  sourceEntityId?: string;
  providerReference?: string;
  status: CustomerStatus;
  createdAt: string;
  updatedAt?: string;
};

export type NewCustomer = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  onboardingReference?: string;
  sourceEntityId?: string;
  providerReference?: string;
  status?: CustomerStatus;
  createdAt: string;
  updatedAt?: string;
};

export function buildCustomer(input: NewCustomer): Customer {
  return {
    customerId: input.customerId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    dateOfBirth: input.dateOfBirth,
    onboardingReference: input.onboardingReference,
    sourceEntityId: input.sourceEntityId,
    providerReference: input.providerReference,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    status: input.status ?? 'pending_kyc'
  };
}
