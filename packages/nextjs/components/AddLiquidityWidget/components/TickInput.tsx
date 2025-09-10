import { Pool, tickToPrice } from "@uniswap/v4-sdk";

interface TickInputProps {
  tickTarget: number;
  setTickTarget: (tickTarget: number) => void;
  pool: Pool | null;
  label: string;
}

export const TickInput = ({ tickTarget, setTickTarget, pool, label }: TickInputProps) => {
  const price =
    pool?.currency0 && pool?.currency1 ? tickToPrice(pool?.currency0, pool?.currency1, tickTarget) : undefined;

  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {pool?.tickSpacing && <span className="text-[10px] text-gray-500">step {pool.tickSpacing}</span>}
      </div>
      <input
        type="number"
        value={tickTarget}
        onChange={e => setTickTarget(Number(e.target.value))}
        step={pool?.tickSpacing || 1}
        className="input input-bordered bg-white text-gray-900 focus:ring-2 focus:ring-gray-300"
        placeholder={`Multiple of ${pool?.tickSpacing || "tick spacing"}`}
      />

      {price && <span className="text-xs text-gray-600">≈ Price: {price.toSignificant(6)}</span>}
    </label>
  );
};
