import { useChainId } from "./useChainId";
import { useAccount } from "wagmi";
import { readContract, writeContract } from "wagmi/actions";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { StrategyId } from "~~/types/avs.types";
import { Contract, getContractsData } from "~~/utils/scaffold-eth/contract";

export const useConfigurePosition = () => {
  const chainId = useChainId();
  const { address } = useAccount();

  const configureAction = async ({
    tickThreshold,
    positionId,
    posM,
  }: {
    tickThreshold: number;
    positionId: number;
    posM: Contract<"PositionManager">;
  }) => {
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
      }
    }

    try {
      const data = await writeContract(wagmiConfig, {
        address: avsContract.address,
        abi: avsContract.abi,
        functionName: "configurePosition",
        args: [tickThreshold, strategyId, BigInt(positionId), posM.address],
        account: address,
      });

      console.log("Data:", data);
      return data;
    } catch (error) {
      console.error(error);
    }
  };

  return {
    configureAction,
  };
};
