import { useMintPosition } from "~~/hooks/useMintPosition";

export const PoolInfoDev = () => {
  const { pool, isLoading } = useMintPosition();
  console.log("pool:", pool);

  const currency0 = pool?.currency0 && "address" in pool?.currency0 ? pool?.currency0.address : pool?.currency0.symbol;
  const currency1 = pool?.currency1 && "address" in pool?.currency1 ? pool?.currency1.address : pool?.currency1.symbol;
  const liquidity = pool?.liquidity.toString();

  return (
    <>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="flex flex-col">
          <h4>Pool Id: {pool?.poolId}</h4>
          <span>Currency 0: {currency0}</span>
          <span>Currency 1: {currency1}</span>
          <span>Current Liquidity: {liquidity}</span>
          <span>Hook address: {pool?.hooks}</span>
        </div>
      )}
    </>
  );
};
