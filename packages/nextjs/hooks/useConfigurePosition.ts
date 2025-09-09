import { useChainId } from "./useChainId";
import { useAccount } from "wagmi";
import { readContract } from "wagmi/actions";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

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
    posM: string;
  }) => {
    const avsContract = getContractsData(chainId).AVS;

    try {
      const data = await readContract(wagmiConfig, {
        address: avsContract.address,
        abi: avsContract.abi,
        functionName: "configurePosition",
        args: [tickThreshold, BigInt(positionId), posM],
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
