import { useEffect, useState } from "react";
import { useMintPosition } from "./useMintPosition";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { Position } from "@uniswap/v4-sdk";

const BIG_READABLE = 1e12;
const nearlyEqual = (a: number, b: number, eps = 1e-9) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

// Utility function to validate and snap tick values to valid tick spacing
const validateAndSnapTick = (inputTick: number, tickSpacing: number): number => {
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;

  // Clamp to valid range first
  const clampedTick = Math.max(MIN_TICK, Math.min(MAX_TICK, inputTick));

  // Snap to nearest valid tick based on spacing
  return nearestUsableTick(clampedTick, tickSpacing);
};

export const useMintAmountPreview = () => {
  const { getMintPreview, pool, isToken0A, isLoading } = useMintPosition();
  const [lastEdited, setLastEdited] = useState<"A" | "B" | null>(null);

  const [fullRange, setFullRange] = useState(true);
  const [lowerTickTarget, setLowerTickTarget] = useState(0);
  const [upperTickTarget, setUpperTickTarget] = useState(0);
  const [amountAReadable, setAmountAReadable] = useState(1);
  const [amountBReadable, setAmountBReadable] = useState(1);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);

  useEffect(() => {
    if (!pool || !getMintPreview) return;

    const pickActuals = (p: Position) => {
      const actualA = isToken0A ? p.amount0.toExact() : p.amount1.toExact();
      const actualB = isToken0A ? p.amount1.toExact() : p.amount0.toExact();
      return { actualA: Number(actualA), actualB: Number(actualB) };
    };

    let preview: Position | null = null;

    if (lastEdited === "A") {
      // Keep A as typed; compute B required for new ticks
      preview = getMintPreview({
        fullRange,
        lowerTickTarget,
        upperTickTarget,
        amountAReadable,
        amountBReadable: BIG_READABLE,
        token0IsA: Boolean(isToken0A),
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
        token0IsA: Boolean(isToken0A),
      });
      if (preview) {
        const { actualA } = pickActuals(preview);
        if (!nearlyEqual(actualA, amountAReadable)) setAmountAReadable(actualA);
      }
    } else {
      preview = getMintPreview({
        fullRange,
        lowerTickTarget,
        upperTickTarget,
        amountAReadable,
        amountBReadable,
        token0IsA: Boolean(isToken0A),
      });
      if (preview) {
        const { actualA, actualB } = pickActuals(preview);

        if (!nearlyEqual(actualA, amountAReadable)) setAmountAReadable(actualA);
        if (!nearlyEqual(actualB, amountBReadable)) setAmountBReadable(actualB);
      }
    }
  }, [
    pool,
    getMintPreview,
    isToken0A,
    fullRange,
    lowerTickTarget,
    upperTickTarget,
    amountAReadable,
    amountBReadable,
    lastEdited,
  ]);

  // Create validated setters that snap to valid tick values
  const setValidatedLowerTick = (inputTick: number) => {
    if (pool) {
      const validTick = validateAndSnapTick(inputTick, pool.tickSpacing);
      setLowerTickTarget(validTick);
    } else {
      setLowerTickTarget(inputTick);
    }
  };

  const setValidatedUpperTick = (inputTick: number) => {
    if (pool) {
      const validTick = validateAndSnapTick(inputTick, pool.tickSpacing);
      setUpperTickTarget(validTick);
    } else {
      setUpperTickTarget(inputTick);
    }
  };

  return {
    pool,
    isLoading,
    fullRange,
    setFullRange,
    lowerTickTarget,
    setLowerTickTarget: setValidatedLowerTick,
    upperTickTarget,
    setUpperTickTarget: setValidatedUpperTick,

    amountAReadable,
    setAmountAReadable,
    amountBReadable,
    setAmountBReadable,
    setLastEdited,
    slippageTolerance,
    setSlippageTolerance,
  };
};
