import { useState } from "react";
import { Button } from "../Button";
import { CurrencyInput } from "./components/CurrencyInput";
import { Settings } from "./components/Settings";
import { ShowSettingsButton } from "./components/ShowSettingsButton";
import { TickInput } from "./components/TickInput";
import { Percent } from "@uniswap/sdk-core";
import { MintOptions, tickToPrice } from "@uniswap/v4-sdk";
import { useAccount } from "wagmi";
import { getBlock } from "wagmi/actions";
import { useMintAmountPreview } from "~~/hooks/useMintAmountPreview";
import { useMintPosition } from "~~/hooks/useMintPosition";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

export const AddLiquidityWidget = () => {
  const {
    pool,
    isLoading,
    fullRange,
    setFullRange,
    lowerTickTarget,
    setLowerTickTarget,
    upperTickTarget,
    setUpperTickTarget,
    amountAReadable,
    setAmountAReadable,
    amountBReadable,
    setAmountBReadable,
    setLastEdited,
    slippageTolerance,
    setSlippageTolerance,
  } = useMintAmountPreview();
  const { mintAction, getMintPreview, isToken0A, isSendingTx } = useMintPosition();

  const { address } = useAccount();

  const [showSettings, setShowSettings] = useState(false);

  const currentPrice =
    pool?.currency0 && pool?.currency1 ? tickToPrice(pool?.currency0, pool?.currency1, pool?.tickCurrent) : undefined;

  return (
    <div className="flex flex-col gap-4 pt-8">
      <div className="max-w-md w-full border rounded-2xl bg-white border-gray-200 shadow-sm mx-auto overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add Liquidity</h2>
            <div className="text-xs text-gray-600 flex gap-2">
              <span>Current tick: {pool?.tickCurrent ?? "-"}</span>
              {pool && <span>• Spacing: {pool.tickSpacing}</span>}
              {currentPrice && <span>• Current price: {currentPrice.toSignificant(6)}</span>}
            </div>
          </div>
          <ShowSettingsButton showSettings={showSettings} setShowSettings={setShowSettings} />
        </div>

        {showSettings && (
          <div className="px-5 pt-4">
            <Settings slippageTolerance={slippageTolerance} setSlippageTolerance={setSlippageTolerance} />
          </div>
        )}

        <form className="flex flex-col gap-4 px-5 py-5">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={fullRange} onChange={e => setFullRange(e.target.checked)} />
            Full range
          </label>

          {!fullRange && (
            <div className="grid grid-cols-2 gap-3">
              <TickInput
                tickTarget={lowerTickTarget}
                setTickTarget={setLowerTickTarget}
                pool={pool}
                label="Lower tick"
              />
              <TickInput
                tickTarget={upperTickTarget}
                setTickTarget={setUpperTickTarget}
                pool={pool}
                label="Upper tick"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              amountReadable={amountAReadable}
              setAmountReadable={setAmountAReadable}
              setLastEdited={() => setLastEdited("A")}
              currency={pool?.currency0}
              label="A"
            />

            <CurrencyInput
              amountReadable={amountBReadable}
              setAmountReadable={setAmountBReadable}
              setLastEdited={() => setLastEdited("B")}
              currency={pool?.currency1}
              label="B"
            />
          </div>

          <Button
            onClick={async () => {
              if (!address) {
                return;
              }

              const position = getMintPreview({
                fullRange,
                lowerTickTarget,
                upperTickTarget,
                amountAReadable,
                amountBReadable,
                token0IsA: Boolean(isToken0A),
              });

              if (!position) {
                return;
              }

              const slippagePct = new Percent(Math.floor(slippageTolerance * 100), 10_000);
              const deadlineSeconds = 120 * 60;
              const currentBlock = await getBlock(wagmiConfig);
              const deadline = Number(currentBlock.timestamp) + deadlineSeconds;

              const mintOptions: MintOptions = {
                recipient: address,
                slippageTolerance: slippagePct,
                deadline: deadline,
              };

              mintAction({
                position,
                mintOptions,
              });
            }}
            disabled={isSendingTx}
            className="w-full"
          >
            Add Liquidity
          </Button>
        </form>
        {(isLoading || (!pool && !isLoading)) && (
          <div className="px-5 pb-5 text-sm text-gray-600">
            {isLoading ? "Loading pool..." : "Pool not available yet."}
          </div>
        )}
      </div>
    </div>
  );
};
