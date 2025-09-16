import { useMemo, useState } from "react";
import { useChainId } from "./useChainId";
import { usePoolData } from "./usePoolData";
import { Token } from "@uniswap/sdk-core";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { MintOptions, Pool, V4PositionManager } from "@uniswap/v4-sdk";
import { Position } from "@uniswap/v4-sdk";
import { decodeEventLog, erc20Abi, maxUint48, maxUint256 } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { readContract, signTypedData, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { MOCK_CURRENCY0, MOCK_CURRENCY1, MOCK_FEE, MOCK_TICK_SPACING } from "~~/contracts/deployedContracts";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { storePosition } from "~~/utils/localStorage";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

const PERMIT2_TYPES = {
  PermitBatch: [
    { name: "details", type: "PermitDetails[]" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
};

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
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [isSendingTx, setIsSendingTx] = useState(false);

  const token0 = new Token(chainId, MOCK_CURRENCY0, 6);
  const token1 = new Token(chainId, MOCK_CURRENCY1, 6);

  const { sqrtPriceX96Current, currentLiquidity, currentTick, isLoading } = usePoolData();

  const hookAddress = getContractsData(chainId).LPRebalanceHook.address;

  const pool = useMemo(() => {
    const hasValues = sqrtPriceX96Current !== undefined && currentLiquidity !== undefined && currentTick !== undefined;
    if (!hasValues) return null;

    return new Pool(
      token0,
      token1,
      MOCK_FEE,
      MOCK_TICK_SPACING,
      hookAddress,
      sqrtPriceX96Current!.toString(),
      currentLiquidity!.toString(),
      currentTick!,
    );
  }, [token0?.address, token1?.address, hookAddress, sqrtPriceX96Current, currentLiquidity, currentTick]);

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
  }): Position | null => {
    if (!pool || isNaN(amountAReadable) || isNaN(amountBReadable)) return null;

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
      return null;
    }

    const position = Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: amount0Desired,
      amount1: amount1Desired,
      useFullPrecision: true,
    });

    return position;
  };

  const mintAction = async ({ position, mintOptions }: { position: Position; mintOptions: MintOptions }) => {
    if (!address) {
      throw new Error("Address not found");
    }
    if (!pool) {
      throw new Error("Pool not found");
    }

    // permit2
    const usePermit2 = true;

    if (usePermit2) {
      // Generate Permit2 data only for ERC20 tokens (not needed for native ETH)
      const permitDetails = [];

      if (!token0.isNative) {
        const [, , nonce] = (await readContract(wagmiConfig, {
          account: address,
          address: getContractsData(chainId).Permit2.address,
          abi: getContractsData(chainId).Permit2.abi,
          functionName: "allowance",
          args: [address, token0.address, getContractsData(chainId).PositionManager.address],
        })) as [bigint, number, number];

        const currentAllowance0 = (await readContract(wagmiConfig, {
          account: address,
          address: token0.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, getContractsData(chainId).Permit2.address],
        })) as bigint;
        if (currentAllowance0 === 0n) {
          try {
            await writeContract(wagmiConfig, {
              address: token0.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [getContractsData(chainId).Permit2.address, maxUint256],
            });
          } catch (err) {
            console.error(err);
            return;
          }
        }

        permitDetails.push({
          token: token0.address,
          amount: (2n ** 160n - 1n).toString(), // Max uint160
          expiration: Number(maxUint48).toString(),
          nonce: nonce.toString(),
        });
      }

      if (!token1.isNative) {
        const [, , nonce] = (await readContract(wagmiConfig, {
          account: address,
          address: getContractsData(chainId).Permit2.address,
          abi: getContractsData(chainId).Permit2.abi,
          functionName: "allowance",
          args: [address, token1.address, getContractsData(chainId).PositionManager.address],
        })) as [bigint, number, number];

        const currentAllowance1 = (await readContract(wagmiConfig, {
          account: address,
          address: token1.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, getContractsData(chainId).Permit2.address],
        })) as bigint;
        if (currentAllowance1 === 0n) {
          try {
            await writeContract(wagmiConfig, {
              address: token1.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [getContractsData(chainId).Permit2.address, maxUint256],
            });
          } catch (err) {
            console.error(err);
            return;
          }
        }
        permitDetails.push({
          token: token1.address,
          amount: (2n ** 160n - 1n).toString(), // Max uint160
          expiration: Number(maxUint48).toString(),
          nonce: nonce.toString(),
        });
      }

      if (permitDetails.length > 0) {
        const permitData = {
          details: permitDetails,
          spender: getContractsData(chainId).PositionManager.address,
          sigDeadline: mintOptions.deadline.toString(),
        };

        const signature = await signTypedData(wagmiConfig, {
          account: address,
          domain: {
            name: "Permit2",
            chainId,
            verifyingContract: getContractsData(chainId).Permit2.address,
          },
          types: PERMIT2_TYPES,
          primaryType: "PermitBatch",
          message: permitData,
        });

        mintOptions.batchPermit = {
          owner: address,
          permitBatch: permitData,
          signature,
        };
      }
    }

    const { calldata, value } = V4PositionManager.addCallParameters(position, mintOptions);

    setIsSendingTx(true);

    try {
      const hash = await writeContractAsync({
        address: getContractsData(chainId).PositionManager.address,
        abi: getContractsData(chainId).PositionManager.abi,
        functionName: "multicall",
        args: [[calldata]],
        value: BigInt(value),
      });

      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
      });
      console.log("Receipt:", receipt);

      const ml = receipt.logs[1];
      const { args: args2 } = decodeEventLog({
        abi: [modifyLiquidity],
        data: ml.data,
        topics: ml.topics,
      });

      storePosition(pool.poolId, {
        tokenId: Number(BigInt(args2.salt)),
        tickLower: args2.tickLower,
        tickUpper: args2.tickUpper,
        isManaged: false,
      });

      return receipt;
    } catch (error) {
      console.error("Error minting position:", error);
    } finally {
      setIsSendingTx(false);
    }
  };

  return {
    pool,
    isLoading,
    getMintPreview,
    isToken0A: pool ? token0IsA(token0, pool) : null,
    mintAction,
    isSendingTx,
  };
};

const modifyLiquidity = {
  type: "event",
  name: "ModifyLiquidity",
  inputs: [
    { indexed: true, name: "id", type: "bytes32" },
    { indexed: true, name: "sender", type: "address" },
    { indexed: false, name: "tickLower", type: "int24" },
    { indexed: false, name: "tickUpper", type: "int24" },
    { indexed: false, name: "liquidityDelta", type: "int256" },
    { indexed: false, name: "salt", type: "bytes32" },
  ],
} as const;
