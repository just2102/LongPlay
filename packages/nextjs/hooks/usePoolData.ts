import { useChainId } from "./useChainId";
import { useReadContract } from "wagmi";
import { MOCK_POOL_ID } from "~~/contracts/deployedContracts";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

export const usePoolData = () => {
  const chainId = useChainId();

  const { data: slot0, isLoading: isLoadingSlot0 } = useReadContract({
    address: getContractsData(chainId).StateView.address,
    abi: getContractsData(chainId).StateView.abi,
    functionName: "getSlot0",
    args: [MOCK_POOL_ID],
  });

  const { data: liquidity, isLoading: isLoadingLiquidity } = useReadContract({
    address: getContractsData(chainId).StateView.address,
    abi: getContractsData(chainId).StateView.abi,
    functionName: "getLiquidity",
    args: [MOCK_POOL_ID],
  });

  const sqrtPriceX96Current = slot0 ? (slot0[0] as bigint) : undefined;
  const currentTick = slot0 ? (slot0[1] as number) : undefined;
  const currentLiquidity = liquidity ? (liquidity as bigint) : undefined;

  const isLoading = isLoadingSlot0 || isLoadingLiquidity;

  return {
    sqrtPriceX96Current,
    currentTick,
    currentLiquidity,
    isLoading,
  };
};
