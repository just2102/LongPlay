import { useChainId } from "./useChainId";
import { useAccount } from "wagmi";
import { readContract, simulateContract, writeContract } from "wagmi/actions";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { IUserConfig, StrategyId } from "~~/types/avs.types";
import { Contract, getContractsData } from "~~/utils/scaffold-eth/contract";

export const useConfigurePosition = () => {
  const chainId = useChainId();
  const { address } = useAccount();

  const configureAction = async ({
    tickThreshold,
    positionId,
    posM,
    tickSpacing,
  }: {
    tickThreshold: number;
    positionId: number;
    posM: Contract<"PositionManager">;
    tickSpacing: number;
  }): Promise<IUserConfig | undefined> => {
    if (!address) {
      throw new Error("No address found");
    }

    const avsContract = getContractsData(chainId).AVS;
    const strategyId = StrategyId.Asset0ToAave;

    const hasApproval = await readContract(wagmiConfig, {
      address: posM.address,
      abi: posM.abi,
      functionName: "isApprovedForAll",
      args: [address, avsContract.address],
    });

    if (!hasApproval) {
      try {
        const tx = await writeContract(wagmiConfig, {
          address: posM.address,
          abi: posM.abi,
          functionName: "setApprovalForAll",
          args: [avsContract.address, true],
        });
        console.log("Approval TX:", tx);
      } catch (error) {
        console.error(`Error approving position ${positionId} to be spent by the AVS`);
        console.error(error);
        return undefined;
      }
    }

    try {
      const { request, result } = await simulateContract(wagmiConfig, {
        address: avsContract.address,
        abi: avsContract.abi,
        functionName: "configurePosition",
        args: [tickThreshold, strategyId, BigInt(positionId), posM.address, tickSpacing],
        account: address,
      });

      await writeContract(wagmiConfig, request);
      return {
        ...result,
        positionId: positionId.toString(),
      };
    } catch (error) {
      console.error(error);
    }
  };

  return {
    configureAction,
  };
};
