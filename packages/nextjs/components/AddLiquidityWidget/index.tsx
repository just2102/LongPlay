import { useEffect, useMemo, useState } from "react";
import { useMintPosition } from "~~/hooks/useMintPosition";

const BIG_READABLE = 1e12;
const nearlyEqual = (a: number, b: number, eps = 1e-9) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

export const AddLiquidityWidget = () => {
  const { getMintPreview, pool, isLoading, isToken0A } = useMintPosition();

  const [fullRange, setFullRange] = useState(true);
  const [lowerTickTarget, setLowerTickTarget] = useState(0);
  const [upperTickTarget, setUpperTickTarget] = useState(0);

  const [amountAReadable, setAmountAReadable] = useState(1);
  const [amountBReadable, setAmountBReadable] = useState(1);

  const [lastEdited, setLastEdited] = useState<"A" | "B" | null>(null);

  const token0IsA = useMemo(() => Boolean(isToken0A), [isToken0A]);

  useEffect(() => {
    if (!pool || !getMintPreview) return;

    const pickActuals = (p: NonNullable<ReturnType<typeof getMintPreview>>) => {
      const actualA = token0IsA ? Number(p.amount0Actual) : Number(p.amount1Actual);
      const actualB = token0IsA ? Number(p.amount1Actual) : Number(p.amount0Actual);
      return { actualA, actualB };
    };

    let preview = null;

    if (lastEdited === "A") {
      // Keep A as typed; compute B required for new ticks
      preview = getMintPreview({
        fullRange,
        lowerTickTarget,
        upperTickTarget,
        amountAReadable,
        amountBReadable: BIG_READABLE,
        token0IsA,
      });
      if (preview) {
        const { actualB } = pickActuals(preview);
        if (!nearlyEqual(actualB, amountBReadable)) setAmountBReadable(actualB);
      }
    } else if (lastEdited === "B") {
      // Keep B as typed; compute A required for new ticks
      preview = getMintPreview({
        fullRange,
        lowerTickTarget,
        upperTickTarget,
        amountAReadable: BIG_READABLE,
        amountBReadable,
        token0IsA,
      });
      if (preview) {
        const { actualA } = pickActuals(preview);
        if (!nearlyEqual(actualA, amountAReadable)) setAmountAReadable(actualA);
      }
    } else {
      // No anchor yet: recompute both from the current pair
      preview = getMintPreview({
        fullRange,
        lowerTickTarget,
        upperTickTarget,
        amountAReadable,
        amountBReadable,
        token0IsA,
      });
      if (preview) {
        const { actualA, actualB } = pickActuals(preview);
        if (!nearlyEqual(actualA, amountAReadable)) setAmountAReadable(actualA);
        if (!nearlyEqual(actualB, amountBReadable)) setAmountBReadable(actualB);
      }
    }
  }, [pool, getMintPreview, token0IsA, fullRange, lowerTickTarget, upperTickTarget]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Add Liquidity</h1>
      {isLoading && <div>Loading pool...</div>}
      {!pool && !isLoading && <div>Pool not available yet.</div>}

      <form className="flex flex-col gap-3 max-w-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fullRange} onChange={e => setFullRange(e.target.checked)} />
          Full range
        </label>

        {!fullRange && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col">
              <span className="text-sm opacity-70">Lower tick</span>
              <input
                type="number"
                value={lowerTickTarget}
                onChange={e => setLowerTickTarget(Number(e.target.value))}
                className="input input-bordered"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm opacity-70">Upper tick</span>
              <input
                type="number"
                value={upperTickTarget}
                onChange={e => setUpperTickTarget(Number(e.target.value))}
                className="input input-bordered"
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col">
            <span className="text-sm opacity-70">Amount A</span>
            <input
              type="number"
              min={0}
              step={0.000001}
              value={amountAReadable}
              onChange={e => {
                setAmountAReadable(Number(e.target.value));
                setLastEdited("A");
              }}
              className="input input-bordered"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm opacity-70">Amount B</span>
            <input
              type="number"
              min={0}
              step={0.000001}
              value={amountBReadable}
              onChange={e => {
                setAmountBReadable(Number(e.target.value));
                setLastEdited("B");
              }}
              className="input input-bordered"
            />
          </label>
        </div>
      </form>
    </div>
  );
};
