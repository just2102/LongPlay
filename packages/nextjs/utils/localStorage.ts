export interface PositionStored {
  tokenId: number;
  tickLower: number;
  tickUpper: number;
  isManaged: boolean;
}

export const LocalStorageKeys = {
  PositionsByPoolId: (poolId: string) => `positionsByPoolId:${poolId}`,
};

export const storePosition = (poolId: string, position: PositionStored) => {
  if (!window) {
    return;
  }

  const currentPositions = localStorage.getItem(LocalStorageKeys.PositionsByPoolId(poolId));
  const positions = currentPositions ? JSON.parse(currentPositions) : [];
  positions.push(position);
  localStorage.setItem(LocalStorageKeys.PositionsByPoolId(poolId), JSON.stringify(positions));
};

export const getPositions = (poolId: string): PositionStored[] => {
  if (!window) {
    return [];
  }

  const positions = localStorage.getItem(LocalStorageKeys.PositionsByPoolId(poolId));
  return positions ? JSON.parse(positions) : [];
};

export const updatePosition = (poolId: string, position: PositionStored) => {
  if (!window) {
    return;
  }

  const positions = getPositions(poolId);
  const positionIndex = positions.findIndex(_pos => _pos.tokenId === position.tokenId);
  if (positionIndex !== -1) {
    positions[positionIndex] = position;
  }
  localStorage.setItem(LocalStorageKeys.PositionsByPoolId(poolId), JSON.stringify(positions));
};
