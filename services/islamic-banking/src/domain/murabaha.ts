export interface Murabaha {
  assetCost: number;
  markup: number;
  sellingPrice: number;
}

export interface MurabahaInput {
  assetCost: number;
  markup: number;
}

export function calculateMurabaha(input: MurabahaInput): Murabaha {
  const sellingPrice = roundToScale(input.assetCost + input.markup, 6);

  return {
    assetCost: roundToScale(input.assetCost, 6),
    markup: roundToScale(input.markup, 6),
    sellingPrice
  };
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}
