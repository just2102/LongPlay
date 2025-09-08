import { useEffect, useState } from "react";
import { MyPositionsPlaceholder } from "./Placeholder";
import { PositionCard } from "./PositionCard";
import { MOCK_POOL_ID } from "~~/contracts/deployedContracts";
import { PositionStored, getPositions, updatePosition } from "~~/utils/localStorage";

export const MyPositions = () => {
  const [positions, setPositions] = useState<PositionStored[]>([]);

  useEffect(() => {
    const positions = getPositions(MOCK_POOL_ID);
    setPositions(positions);
  }, []);

  const handleUpdatePosition = (position: PositionStored) => {
    updatePosition(MOCK_POOL_ID, position);
    setPositions(getPositions(MOCK_POOL_ID));
  };

  if (positions.length === 0) {
    return <MyPositionsPlaceholder />;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Positions</h2>
        <span className="text-sm text-gray-500">
          {positions.length} position{positions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {positions.map(position => (
          <PositionCard key={position.tokenId} position={position} handleUpdatePosition={handleUpdatePosition} />
        ))}
      </div>
    </div>
  );
};
