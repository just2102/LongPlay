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
