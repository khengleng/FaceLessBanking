import type { CurrencyExposure } from '../domain/exposure.js';

export interface FxExposureAdapter {
  getCurrentCurrencyExposures(reportingCurrency: string): Promise<CurrencyExposure[]>;
}
