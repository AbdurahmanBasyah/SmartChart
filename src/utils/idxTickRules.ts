/**
 * Official Indonesia Stock Exchange (BEI / IDX) Fractional Price Tick Rules
 *
 * Price Brackets                | Tick Size
 * ----------------------------|------------------------
 * < Rp 200                    | Rp 1
 * Rp 200 to < Rp 500          | Rp 2
 * Rp 500 to < Rp 2,000        | Rp 5
 * Rp 2,000 to < Rp 5,000       | Rp 10
 * ≥ Rp 5,000                  | Rp 25
 */

export function getIdxTickSize(price: number, isIhsg: boolean = false): number {
  if (isIhsg) return 1;
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

export function roundToIdxTick(price: number, isIhsg: boolean = false): number {
  if (!price || price <= 0) return 0;
  if (isIhsg) return Math.round(price);
  const tick = getIdxTickSize(price, false);
  return Math.round(price / tick) * tick;
}

export function addIdxTicks(price: number, ticks: number, isIhsg: boolean = false): number {
  let current = Math.max(1, Math.round(price));
  if (isIhsg) {
    return Math.max(1, current + ticks);
  }
  const step = ticks >= 0 ? 1 : -1;
  const count = Math.abs(ticks);

  for (let i = 0; i < count; i++) {
    const tickSize = getIdxTickSize(current, false);
    current += step * tickSize;
    if (current < 1) {
      current = 1;
      break;
    }
  }

  return roundToIdxTick(current, false);
}

export function formatIdxPrice(price: number): string {
  if (price == null || isNaN(price)) return '0';
  return Math.round(price).toLocaleString('en-US');
}

/**
 * Calculates the exact number of ticks/points between two prices according to BEI rules.
 * Handles boundary transitions across tick brackets (e.g. crossing 100, 200, 500, 2000, 5000).
 */
export function countIdxTicksBetween(priceA: number, priceB: number, isIhsg: boolean = false): number {
  if (isIhsg) {
    return Math.round(Math.abs(priceB - priceA));
  }
  const low = Math.min(priceA, priceB);
  const high = Math.max(priceA, priceB);
  if (low === high || isNaN(low) || isNaN(high) || low <= 0) return 0;

  let ticks = 0;
  let current = roundToIdxTick(low, false);
  const target = roundToIdxTick(high, false);

  while (current < target && ticks < 2000) {
    const tickSize = getIdxTickSize(current, false);
    current += tickSize;
    ticks++;
  }

  return ticks;
}

