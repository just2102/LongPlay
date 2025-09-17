import { HookHelpers } from "./HookHelpers";
import { SwapMock } from "./SwapMock";
import { useReadContract } from "wagmi";
import { useChainId } from "~~/hooks/useChainId";
import { useMintPosition } from "~~/hooks/useMintPosition";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

export const PoolInfoDev = () => {
  const { pool, isLoading } = useMintPosition();

  const currency0 = pool?.currency0 && "address" in pool?.currency0 ? pool?.currency0.address : pool?.currency0.symbol;
  const currency1 = pool?.currency1 && "address" in pool?.currency1 ? pool?.currency1.address : pool?.currency1.symbol;
  const liquidity = pool?.liquidity.toString();

  const chainId = useChainId();

  const hookContract = getContractsData(chainId).LPRebalanceHook;
  const { data: service } = useReadContract({
    address: hookContract.address,
    abi: hookContract.abi,
    functionName: "service",
    query: {
      refetchInterval: 3_500,
    },
  });

  return (
    <>
      {isLoading ? (
        <div className="animate-pulse text-sm">Loading...</div>
      ) : (
        <div className="flex flex-col bg-white rounded-md p-4 border border-gray-300 shadow-md">
          <h4>Pool Id: {pool?.poolId}</h4>
          <span>Currency 0: {currency0}</span>
          <span>Currency 1: {currency1}</span>
          <span>Current Liquidity: {liquidity}</span>
          <span>Hook address: {pool?.hooks}</span>
          <span>AVS address in hook (service): {service}</span>
        </div>
      )}

      <div className="flex justify-start gap-4 items-center mr-auto">
        <HookHelpers />

        <SwapMock service={service} />
      </div>
    </>
  );
};
