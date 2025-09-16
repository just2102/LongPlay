import { computeThresholdBounds } from "./bounds";

function assertEqual(actual: any, expected: any, message: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message}\nExpected: ${e}\nActual:   ${a}`);
  }
}

export function runBoundsTests() {
  assertEqual(
    computeThresholdBounds(10, 10),
    { min: 0, max: 0, empty: true },
    "unchanged"
  );

  // Upward move: current 33 > last 28 → [28, 33)
  assertEqual(
    computeThresholdBounds(33, 28),
    { min: 28, max: "(33", empty: false },
    "upward: include 28..32, exclude 33"
  );

  // e.g., current -33 < last -28 → (-33, -28]
  assertEqual(
    computeThresholdBounds(-33, -28),
    { min: "(-33", max: -28, empty: false },
    "downward negative: include -32..-28"
  );

  // e.g., current 28 < last 33, tickSpacing 30 → (30, 33]
  assertEqual(
    computeThresholdBounds(28, 33, 30),
    { min: "(30", max: 33, empty: false },
    "downward positive: exclude <= tickSpacing (28,29,30)"
  );

  // edge: tickSpacing above lastTick → empty
  assertEqual(
    computeThresholdBounds(20, 25, 26),
    { min: 0, max: 0, empty: true },
    "tickSpacing >= lastTick → empty"
  );
}

runBoundsTests();
console.log("computeThresholdBounds tests passed");
