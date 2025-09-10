import { useSyncExternalStore } from "react";
import { MyPositionsPlaceholder } from "./Placeholder";
import { PositionCard } from "./PositionCard";
import { MOCK_POOL_ID } from "~~/contracts/deployedContracts";
import { useChainId } from "~~/hooks/useChainId";
import { useConfigurePosition } from "~~/hooks/useConfigurePosition";
import { useMintPosition } from "~~/hooks/useMintPosition";
import {
  PositionStored,
  clearPositions,
  getPositionsSnapshot,
  subscribeToPositions,
  updatePosition,
} from "~~/utils/localStorage";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

export const MyPositions = () => {
  const chainId = useChainId();
  const { configureAction } = useConfigurePosition();

  const { pool } = useMintPosition();

  const positions = useSyncExternalStore(
    subscribeToPositions,
    () => getPositionsSnapshot(MOCK_POOL_ID),
    () => [],
  );

  const handleConfigurePosition = async (position: PositionStored) => {
    await configureAction({
      tickThreshold: -120,
      positionId: position.tokenId,
      posM: getContractsData(chainId).PositionManager,
    });

    updatePosition(MOCK_POOL_ID, position);
  };

  if (positions.length === 0) {
    return <MyPositionsPlaceholder />;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Positions</h2>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {positions.length} position{positions.length !== 1 ? "s" : ""}
          </span>

          <span
            className="text-sm border border-gray-500 rounded-md px-2 py-1 text-gray-500 cursor-pointer"
            onClick={() => {
              clearPositions(MOCK_POOL_ID);
            }}
          >
            Clear All
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-stretch">
        {positions.map(position => {
          const baseCurrency = pool?.currency0;
          const quoteCurrency = pool?.currency1;
          return (
            <PositionCard
              key={position.tokenId}
              position={position}
              handleConfigurePosition={handleConfigurePosition}
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
            />
          );
        })}
      </div>
    </div>
  );
};
