import { IUserConfig, STRATEGY_LABELS_TO_DESCRIPTION } from "~~/types/avs.types";

interface PositionConfigInfoProps {
  userConfig: IUserConfig;
}

export const PositionConfigInfo = ({ userConfig }: PositionConfigInfoProps) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Configuration</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-gray-500">Tick threshold</span>
          <span className="font-mono text-gray-900">{userConfig.tickThreshold}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-gray-500">Strategy Description</span>
          <span className="font-mono text-gray-900">{STRATEGY_LABELS_TO_DESCRIPTION[userConfig.strategyId]}</span>
        </div>
      </div>
    </div>
  );
};
