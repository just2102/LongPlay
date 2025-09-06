import { useEffect } from "react";
import { useChainId } from "./useChainId";
import { useReadContract } from "wagmi";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

export const useLastTick = (poolId: string) => {
  const chainId = useChainId();

  const contractData = getContractsData(chainId).LPRebalanceHook;
  const {
    data: lastTick,
    error,
    isLoading,
    isError,
    isFetched,
  } = useReadContract({
    abi: contractData.abi,
    address: contractData.address,
    functionName: "lastTicks",
    args: [poolId],
  });

  useEffect(() => {
    if (error) {
      console.error(error);
    }
    if (isLoading) {
      console.log("Loading...");
    }
    if (lastTick) {
      console.log(lastTick);
    }

    if (isError) {
      console.error(error);
    }
    if (isFetched) {
      console.log("Fetched");
    }
  }, [error, isLoading, lastTick, isError, isFetched]);

  return {
    lastTick,
  };
};
