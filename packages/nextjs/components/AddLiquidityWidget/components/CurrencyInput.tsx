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

  return (
    <label className="flex flex-col">
      <span className="text-sm opacity-70 text-gray-700">Amount {label}</span>
      <input
        type="number"
        min={0}
        step={0.000001}
        value={amountReadable}
        onChange={e => {
          setAmountReadable(Number(e.target.value));
          setLastEdited("A");
        }}
        className="input input-bordered bg-gray-950 text-white"
      />

      {tokenBalance && (
        <span className="text-sm opacity-70 flex justify-between text-gray-700">
          Balance: {Number(formatUnits(tokenBalance, decimals)).toFixed(6)}
        </span>
      )}
    </label>
  );
};
