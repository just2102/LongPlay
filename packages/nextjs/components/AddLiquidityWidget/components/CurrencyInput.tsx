import { Currency } from "@uniswap/sdk-core";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";

export const CurrencyInput = ({
  amountReadable,
  setAmountReadable,
  setLastEdited,
  currency,
  label,
}: {
  amountReadable: number;
  setAmountReadable: (amount: number) => void;
  setLastEdited: (lastEdited: "A" | "B") => void;
  currency: Currency | undefined;
  label: string;
}) => {
  const { address } = useAccount();

  const currencyAddress = !currency?.isNative ? currency?.address : undefined;

  const { data: tokenBalance } = useReadContract({
    address: currencyAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    query: {
      enabled: !!address && !!currencyAddress,
      refetchInterval: 7_000,
    },
  });

  const decimals = currency?.decimals || 18;

  const readableBalance = tokenBalance ? Number(formatUnits(tokenBalance, decimals)) : undefined;

  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Amount {label}</span>
        {currency?.symbol && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            {currency.symbol}
          </span>
        )}
      </div>
      <input
        type="number"
        min={0}
        step={0.000001}
        value={amountReadable}
        onChange={e => {
          setAmountReadable(Number(e.target.value));
          setLastEdited(label as "A" | "B");
        }}
        className="input input-bordered bg-white text-gray-900 focus:ring-2 focus:ring-gray-300"
      />

      {readableBalance !== undefined && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Balance: {readableBalance.toFixed(6)}</span>
          <button
            type="button"
            className="underline hover:opacity-80 cursor-pointer"
            onClick={() => {
              setAmountReadable(readableBalance);
              setLastEdited(label as "A" | "B");
            }}
          >
            Max
          </button>
        </div>
      )}
    </label>
  );
};
