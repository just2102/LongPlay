export const StrategyId = {
  None: 0,
  Asset0ToAave: 1,
  Asset1ToAave: 2,
} as const;

export const STRATEGY_LABELS_TO_DESCRIPTION: Record<number, string> = {
  [StrategyId.None]: "No strategy. The position will not be managed by the AVS.",
  [StrategyId.Asset0ToAave]:
    "When the price of Asset 0 is below the price threshold, withdraw Asset 0 and deposit to Aave",
  [StrategyId.Asset1ToAave]:
    "When the price of Asset 1 is above the price threshold, withdraw Asset 1 and deposit to Aave",
};

export interface IUserConfig {
  tickThreshold: number;
  strategyId: number;
  owner: string;
  positionId: string;
  posM: string;
}
