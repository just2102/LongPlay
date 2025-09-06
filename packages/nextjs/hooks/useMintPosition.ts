import { useChainId } from "./useChainId";
import { usePoolData } from "./usePoolData";
import { Token } from "@uniswap/sdk-core";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { Pool } from "@uniswap/v4-sdk";
import { Position } from "@uniswap/v4-sdk";
import { MOCK_CURRENCY0, MOCK_CURRENCY1, MOCK_FEE, MOCK_TICK_SPACING } from "~~/contracts/deployedContracts";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

export const token0IsA = (tokenA: Token, pool: Pool) => {
  if (!pool.token0) {
    throw new Error("Pool token0 not found");
  }

  if (!("address" in pool.token0)) {
    throw new Error("Pool.token0 has no address");
  }

  return tokenA.address === pool.token0.address;
};

export const useMintPosition = () => {
  const chainId = useChainId();

  const token0 = new Token(chainId, MOCK_CURRENCY0, 18);
  const token1 = new Token(chainId, MOCK_CURRENCY1, 18);

  const { sqrtPriceX96Current, currentLiquidity, currentTick, isLoading } = usePoolData();

  const hookAddress = getContractsData(chainId).LPRebalanceHook.address;

  const hasValues = sqrtPriceX96Current !== undefined && currentLiquidity !== undefined && currentTick !== undefined;

  const pool = hasValues
    ? new Pool(
        token0,
        token1,
        MOCK_FEE,
        MOCK_TICK_SPACING,
        hookAddress,
        sqrtPriceX96Current!.toString(),
        currentLiquidity!.toString(),
        currentTick!,
      )
    : null;

  const getMintPreview = ({
    fullRange,
    lowerTickTarget,
    upperTickTarget,
    amountAReadable,
    amountBReadable,
    token0IsA,
  }: {
    fullRange: boolean;
    lowerTickTarget: number;
    upperTickTarget: number;
    amountAReadable: number;
    amountBReadable: number;
    token0IsA: boolean;
  }) => {
    if (!pool) return null;

    const poolTickSpacing = pool.tickSpacing;

    let tickLower: number;
    let tickUpper: number;

    if (fullRange) {
      const MIN_TICK = -887272;
      const MAX_TICK = 887272;
      tickLower = nearestUsableTick(MIN_TICK, poolTickSpacing);
      tickUpper = nearestUsableTick(MAX_TICK, poolTickSpacing);
    } else {
      const MIN_TICK = -887272;
      const MAX_TICK = 887272;
      const clampedLower = Math.max(MIN_TICK, Math.min(MAX_TICK, lowerTickTarget));
      const clampedUpper = Math.max(MIN_TICK, Math.min(MAX_TICK, upperTickTarget));
      tickLower = nearestUsableTick(clampedLower, poolTickSpacing);
      tickUpper = nearestUsableTick(clampedUpper, poolTickSpacing);
      if (tickLower >= tickUpper) {
        // Ensure at least one tickSpacing difference to avoid division-by-zero
        const canBumpUpper = tickUpper + poolTickSpacing <= 887272;
        if (canBumpUpper) {
          tickUpper = tickLower + poolTickSpacing;
        } else if (tickLower - poolTickSpacing >= -887272) {
          tickLower = tickUpper - poolTickSpacing;
        } else {
          return null;
        }
      }
    }

    const amountADesired = BigInt(Math.floor(amountAReadable * 10 ** token0.decimals));
    const amountBDesired = BigInt(Math.floor(amountBReadable * 10 ** token1.decimals));

    const amount0Desired = token0IsA ? amountADesired.toString() : amountBDesired.toString();
    const amount1Desired = token0IsA ? amountBDesired.toString() : amountADesired.toString();

    // Avoid constructing positions with both amounts at zero
    if (amount0Desired === "0" && amount1Desired === "0") {
      return {
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Actual: "0",
        amount1Actual: "0",
        liquidity: "0",
      };
    }

    const position = Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: amount0Desired,
      amount1: amount1Desired,
      useFullPrecision: true,
    });

    return {
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Actual: position.amount0.toExact(),
      amount1Actual: position.amount1.toExact(),
      liquidity: position.liquidity.toString(),
    };
  };

  return {
    pool,
    isLoading,
    getMintPreview,
    isToken0A: pool ? token0IsA(token0, pool) : null,
  };
};
