export const Settings = ({
  slippageTolerance,
  setSlippageTolerance,
}: {
  slippageTolerance: number;
  setSlippageTolerance: (value: number) => void;
}) => {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">Transaction Settings</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Slippage tolerance</label>
        <div className="flex gap-2">
          {[0.5, 1].map(value => (
            <button
              type="button"
              key={value}
              onClick={() => setSlippageTolerance(value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                slippageTolerance === value
                  ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              {value}%
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Your transaction will revert if the price changes unfavorably by more than this percentage.
        </p>
      </div>
    </div>
  );
};
