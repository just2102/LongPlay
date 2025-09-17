import { useChainId } from "./useChainId";
import { Currency } from "@uniswap/sdk-core";
import { useAccount, useReadContract } from "wagmi";
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { IUserConfig, StrategyId } from "~~/types/avs.types";
import { StepId, StepStatus } from "~~/types/tx-types";
import { ZERO_ADDRESS } from "~~/utils/scaffold-eth/common";
import { Contract, getContractsData } from "~~/utils/scaffold-eth/contract";

type OnProgress = (step: StepId, status: StepStatus, meta?: { txHash?: `0x${string}`; error?: string }) => void;

export const useConfigurePosition = () => {
  const chainId = useChainId();
  const { address } = useAccount();
  const avsContract = getContractsData(chainId).AVS;

  const { data: serviceFee } = useReadContract({
    abi: avsContract.abi,
    address: avsContract.address,
    functionName: "SERVICE_FEE",
    args: [],
    query: { refetchOnMount: false, refetchInterval: 15_000 },
  });

  const configureAction = async ({
    tickThreshold,
    strategyId,
    positionId,
    posM,
    tickSpacing,
    currency0,
    currency1,
    onProgress,
  }: {
    tickThreshold: number;
    strategyId: number;
    positionId: number;
    posM: Contract<"PositionManager">;
    tickSpacing: number;
    currency0: Currency | undefined;
    currency1: Currency | undefined;
    onProgress: OnProgress;
  }): Promise<IUserConfig | undefined> => {
    if (!address) {
      throw new Error("No address found");
    }

    if (!currency0 || !currency1) {
      throw new Error("No currency found");
    }

    const chosenStrategyId = strategyId ?? StrategyId.Asset0ToAave;

    const hasApproval = await readContract(wagmiConfig, {
      address: posM.address,
      abi: posM.abi,
      functionName: "isApprovedForAll",
      args: [address, avsContract.address],
    });

    if (!hasApproval) {
      try {
        onProgress?.("approval", "pending");
        const hash = await writeContract(wagmiConfig, {
          address: posM.address,
          abi: posM.abi,
          functionName: "setApprovalForAll",
          args: [avsContract.address, true],
        });
        console.log("Approval TX:", hash);
        await waitForTransactionReceipt(wagmiConfig, { hash });
        onProgress?.("approval", "success", { txHash: hash });
      } catch (error) {
        console.error(error);
        onProgress?.("approval", "error", { error: "Error approving position" });
        return undefined;
      }
    } else {
      onProgress?.("approval", "skipped");
    }

    try {
      onProgress?.("configure", "pending");
      const { request, result } = await simulateContract(wagmiConfig, {
        address: avsContract.address,
        abi: avsContract.abi,
        functionName: "configurePosition",
        args: [
          tickThreshold,
          chosenStrategyId,
          BigInt(positionId),
          posM.address,
          tickSpacing,
          currency0.isNative ? ZERO_ADDRESS : currency0.address,
          currency1.isNative ? ZERO_ADDRESS : currency1.address,
        ],
        account: address,
        value: serviceFee,
      });

      const hash = await writeContract(wagmiConfig, request);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      onProgress?.("configure", "success", { txHash: hash });
      return {
        ...result,
        positionId: positionId.toString(),
      };
    } catch (error) {
      console.error(error);
      onProgress?.("configure", "error", { error: "Error configuring position" });
    }
  };

  const cancelDelegationAction = async ({
    positionId,
    posM,
  }: {
    positionId: number;
    posM: Contract<"PositionManager">;
  }) => {
    try {
      const hash = await writeContract(wagmiConfig, {
        address: avsContract.address,
        abi: avsContract.abi,
        functionName: "cancelDelegation",
        args: [BigInt(positionId), posM.address],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
    } catch (error) {
      console.error(error);
    }
  };

  return {
    configureAction,
    cancelDelegationAction,
  };
};
