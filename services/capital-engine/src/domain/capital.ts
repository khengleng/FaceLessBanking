export type AssetType = 'LOAN_SECURED' | 'LOAN_UNSECURED' | 'LOAN_RETAIL' | 'CASH' | 'OTHER';

export interface ExposureInput {
  assetType: AssetType;
  exposure: number;
  currency: string;
}

export interface RWA {
  assetType: AssetType;
  exposure: number;
  riskWeight: number;
  rwaValue: number;
}

export interface RWAResult {
  currency: string;
  rows: RWA[];
  totalRwa: number;
  calculatedAt: string;
}

export interface CapitalBase {
  capital: number;
  currency: string;
}

export interface CARResult {
  capital: number;
  totalRwa: number;
  car: number | null;
  currency: string;
  calculatedAt: string;
}

export const RISK_WEIGHTS: Record<AssetType, number> = {
  LOAN_SECURED: 0.5,
  LOAN_UNSECURED: 1,
  LOAN_RETAIL: 0.75,
  CASH: 0,
  OTHER: 1
};
