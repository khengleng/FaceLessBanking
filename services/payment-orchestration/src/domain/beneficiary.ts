export type Beneficiary = {
  beneficiaryId: string;
  customerId: string;
  name: string;
  accountId: string;
  bankCode: string;
  createdAt: string;
  status: 'active';
};

export type NewBeneficiary = {
  beneficiaryId: string;
  customerId: string;
  name: string;
  accountId: string;
  bankCode: string;
  createdAt: string;
};

export function buildBeneficiary(input: NewBeneficiary): Beneficiary {
  return {
    beneficiaryId: input.beneficiaryId,
    customerId: input.customerId,
    name: input.name,
    accountId: input.accountId,
    bankCode: input.bankCode,
    createdAt: input.createdAt,
    status: 'active'
  };
}
