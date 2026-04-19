import { calculateMurabaha, type Murabaha, type MurabahaInput } from '../domain/murabaha.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class IslamicBankingApplication {
  constructor(private readonly logger: Logger) {}

  calculateMurabaha(input: MurabahaInput): Murabaha {
    const result = calculateMurabaha(input);

    this.logger.info(
      {
        assetCost: result.assetCost,
        markup: result.markup,
        sellingPrice: result.sellingPrice
      },
      'Calculated Murabaha selling price using profit-based formula'
    );

    return result;
  }
}
