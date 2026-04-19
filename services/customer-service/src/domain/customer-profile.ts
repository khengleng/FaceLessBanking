export type VerificationStatus = 'UNVERIFIED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type ContactStatus = 'UNCONFIRMED' | 'CONFIRMED' | 'UNKNOWN';

export type CustomerProfile = {
  customerId: string;
  displayName?: string;
  onboardingReference?: string;
  verificationStatus: VerificationStatus;
  riskLevel: RiskLevel;
  countryCode?: string;
  contactStatus: ContactStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomerProfilePatch = Partial<{
  displayName: string;
  onboardingReference: string;
  verificationStatus: VerificationStatus;
  riskLevel: RiskLevel;
  countryCode: string;
  contactStatus: ContactStatus;
}>;

export function buildCustomerProfile(input: {
  customerId: string;
  displayName?: string;
  onboardingReference?: string;
  verificationStatus?: VerificationStatus;
  riskLevel?: RiskLevel;
  countryCode?: string;
  contactStatus?: ContactStatus;
  createdAt: string;
  updatedAt?: string;
}): CustomerProfile {
  return {
    customerId: input.customerId,
    displayName: input.displayName,
    onboardingReference: input.onboardingReference,
    verificationStatus: input.verificationStatus ?? 'UNVERIFIED',
    riskLevel: input.riskLevel ?? 'UNKNOWN',
    countryCode: input.countryCode,
    contactStatus: input.contactStatus ?? 'UNKNOWN',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt
  };
}
