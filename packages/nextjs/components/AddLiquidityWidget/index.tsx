import { useState } from "react";
import { Button } from "../Button";
import { CurrencyInput } from "./components/CurrencyInput";
import { Settings } from "./components/Settings";
import { ShowSettingsButton } from "./components/ShowSettingsButton";
import { TickInput } from "./components/TickInput";
import { Percent } from "@uniswap/sdk-core";
import { MintOptions } from "@uniswap/v4-sdk";
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

  return (
    <div className="flex flex-col gap-4 ">
      <div className="flex items-center gap-3 pt-4">
        <h1 className="text-xl font-bold">Add Liquidity</h1>
      </div>

      {isLoading && <div>Loading pool...</div>}
      {!pool && !isLoading && <div>Pool not available yet.</div>}

      <div className="text-sm space-y-1">
        <h3>Current tick: {pool?.tickCurrent}</h3>
        {pool && <p>Tick spacing: {pool.tickSpacing}</p>}
      </div>

      <form
        className="flex flex-col gap-3 max-w-sm border rounded-xl p-4
      bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300
      "
      >
        <div className="flex justify-between">
          <label
            className="flex items-center gap-2
          text-gray-700
          "
          >
            <input type="checkbox" checked={fullRange} onChange={e => setFullRange(e.target.checked)} />
            Full range
          </label>

          <ShowSettingsButton showSettings={showSettings} setShowSettings={setShowSettings} />
        </div>

        {showSettings && <Settings slippageTolerance={slippageTolerance} setSlippageTolerance={setSlippageTolerance} />}

        {!fullRange && (
          <div className="grid grid-cols-2 gap-2">
            <TickInput tickTarget={lowerTickTarget} setTickTarget={setLowerTickTarget} pool={pool} label="Lower tick" />
            <TickInput tickTarget={upperTickTarget} setTickTarget={setUpperTickTarget} pool={pool} label="Upper tick" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
};
