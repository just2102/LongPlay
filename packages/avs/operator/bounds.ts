export type BoundsResult = {
  min: string | number;
  max: string | number;
  empty: boolean;
};

// Determine search bounds for tick thresholds between lastTick and currentTick.
// Rules:
// - If price moved up (current > last): search [lastTick, currentTick)
// - If price moved down (current < last): search (currentTick, lastTick]
// Additional rule for positive downward moves: exclude values <= tickSpacing
export function computeThresholdBounds(
  currentTick: number,
  lastTick: number,
  tickSpacing?: number
): BoundsResult {
  if (currentTick === lastTick) {
    return { min: 0, max: 0, empty: true };
  }

  if (currentTick > lastTick) {
    // [last, current)
    return { min: lastTick, max: `(${currentTick}`, empty: false };
  }

  // currentTick < lastTick → downward move
  if (currentTick >= 0 && lastTick >= 0 && typeof tickSpacing === "number") {
    const lowerExclusive = Math.max(currentTick, tickSpacing);
    if (lowerExclusive >= lastTick) {
      return { min: 0, max: 0, empty: true };
    }
    return { min: `(${lowerExclusive}`, max: lastTick, empty: false };
  }

  // default: (current, last]
  return { min: `(${currentTick}`, max: lastTick, empty: false };
}
