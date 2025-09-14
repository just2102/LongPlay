export const StrategyId = {
  None: 0,
  Asset0ToAave: 1,
} as const;

export const STRATEGY_LABELS_TO_DESCRIPTION: Record<number, string> = {
  [StrategyId.None]: "No strategy",
  [StrategyId.Asset0ToAave]:
    "When the price of Asset 0 is below the tick threshold, withdraw Asset 0 and deposit to Aave",
};

export interface IUserConfig {
  tickThreshold: number;
  strategyId: number;
  owner: string;
  positionId: string;
  posM: string;
}
