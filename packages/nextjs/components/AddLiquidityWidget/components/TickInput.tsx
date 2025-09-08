import { Pool } from "@uniswap/v4-sdk";

interface TickInputProps {
  tickTarget: number;
  setTickTarget: (tickTarget: number) => void;
  pool: Pool | null;
  label: string;
}

export const TickInput = ({ tickTarget, setTickTarget, pool, label }: TickInputProps) => {
  return (
    <label className="flex flex-col">
      <span className="text-sm opacity-70 text-gray-700">{label}</span>
      <input
        type="number"
        value={tickTarget}
        onChange={e => setTickTarget(Number(e.target.value))}
        step={pool?.tickSpacing || 1}
        className="input input-bordered bg-gray-950 text-white"
        placeholder={`Multiple of ${pool?.tickSpacing || "tick spacing"}`}
      />
    </label>
  );
};
