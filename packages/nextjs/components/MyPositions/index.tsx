import { useState, useSyncExternalStore } from "react";
import { ConfigurePositionModal } from "./ConfigurePositionModal";
import { MyPositionsPlaceholder } from "./Placeholder";
import { PositionCard } from "./PositionCard";
import { MOCK_POOL_ID } from "~~/contracts/deployedContracts";
import { useConfigurePosition } from "~~/hooks/useConfigurePosition";
import { useMintPosition } from "~~/hooks/useMintPosition";
import { StrategyId } from "~~/types/avs.types";
import { PositionStored, clearPositions, getPositionsSnapshot, subscribeToPositions } from "~~/utils/localStorage";

export const MyPositions = () => {
  const { pool } = useMintPosition();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionStored | null>(null);
  const [strategyId, setStrategyId] = useState<number>(StrategyId.Asset0ToAave);

  const positions = useSyncExternalStore(
    subscribeToPositions,
    () => getPositionsSnapshot(MOCK_POOL_ID),
    () => [],
  );

  const openConfigureModal = (position: PositionStored) => {
    setSelectedPosition(position);
    setIsModalOpen(true);
  };

  const { cancelDelegationAction } = useConfigurePosition();

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
              handleConfigurePosition={openConfigureModal}
              handleCancelDelegation={cancelDelegationAction}
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
            />
          );
        })}
      </div>

      <ConfigurePositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        setSelectedPosition={setSelectedPosition}
        selectedPosition={selectedPosition}
        strategyId={strategyId}
        setStrategyId={setStrategyId}
        baseCurrency={pool?.currency0}
        quoteCurrency={pool?.currency1}
        tickSpacing={pool?.tickSpacing}
      />
    </div>
  );
};
