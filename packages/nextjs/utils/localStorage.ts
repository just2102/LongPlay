import { IUserConfig } from "~~/types/avs.types";

export interface PositionStored {
  tokenId: number;
  tickLower: number;
  tickUpper: number;
  isManaged: boolean;

  userConfig?: IUserConfig;
}

export const LocalStorageKeys = {
  PositionsByPoolId: (poolId: string) => `positionsByPoolId:${poolId}`,
};

// Cache snapshots by pool so getSnapshot returns a stable reference
const positionsCache = new Map<string, PositionStored[]>();

const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

export const subscribeToPositions = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

export const getPositionsSnapshot = (poolId: string) => {
  const cached = positionsCache.get(poolId);
  if (cached) return cached;

  const initial = getPositions(poolId);
  positionsCache.set(poolId, initial);
  return initial;
};

export const storePosition = (poolId: string, position: PositionStored) => {
  if (!window) {
    return;
  }

  const currentPositions = localStorage.getItem(LocalStorageKeys.PositionsByPoolId(poolId));
  const positions = currentPositions ? JSON.parse(currentPositions) : [];
  positions.push(position);
  localStorage.setItem(LocalStorageKeys.PositionsByPoolId(poolId), JSON.stringify(positions));
  // update cache and notify
  positionsCache.set(poolId, positions);
  notifySubscribers();
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
  // update cache and notify
  positionsCache.set(poolId, positions);
  notifySubscribers();
};

export const clearPositions = (poolId: string) => {
  if (!window) {
    return;
  }
  localStorage.removeItem(LocalStorageKeys.PositionsByPoolId(poolId));
  // update cache and notify
  positionsCache.set(poolId, []);
  notifySubscribers();
};
