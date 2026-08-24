export interface CanonicalCandlePrices {
  open: number;
  high: number;
  low: number;
  close: number;
}

export function canonicalizeCandlePrices(
  open: number,
  high: number,
  low: number,
  close: number,
  roundPrice: (value: number) => number,
): CanonicalCandlePrices {
  const roundedOpen = roundPrice(open);
  const roundedHigh = roundPrice(high);
  const roundedLow = roundPrice(low);
  const roundedClose = roundPrice(close);

  return {
    open: roundedOpen,
    high: Math.max(roundedHigh, roundedOpen, roundedClose),
    low: Math.min(roundedLow, roundedOpen, roundedClose),
    close: roundedClose,
  };
}
