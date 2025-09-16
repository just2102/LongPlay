export interface UserConfig {
  tickThreshold: bigint;
  strategyId: bigint;
  owner: string;
  positionId: bigint;
  posM: string;
}

interface PoolKeyCustom {
  currency0: string;
  currency1: string;
  fee: bigint;
  tickSpacing: bigint;
  hookAddress: string;
}
export interface Task {
  poolKey: PoolKeyCustom;
  lastTick: bigint;
  deadline: bigint;
  createdBlock: bigint;
}

export const StrategyId = {
  None: 0,
  Asset0ToAave: 1,
  Asset1ToAave: 2,
} as const;
