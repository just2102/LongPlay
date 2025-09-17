interface StrategyInputWithLabelProps {
  isChecked: boolean;
  setStrategyId: (id: number) => void;
  description: string;
  label: string;
  strategyId: number;
  isDisabled?: boolean;
}
export const StrategyInputWithLabel = ({
  isChecked,
  setStrategyId,
  description,
  label,
  strategyId,
  isDisabled = false,
}: StrategyInputWithLabelProps) => {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
        isChecked ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
      } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input
        type="radio"
        name="strategy"
        className="mt-1"
        checked={isChecked}
        onChange={() => setStrategyId(strategyId)}
        disabled={isDisabled}
      />
      <div>
        <div className="text-sm font-medium text-gray-900">
          {label} {isDisabled && <span className="text-gray-500 text-xs">Coming soon</span>}
        </div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </label>
  );
};
