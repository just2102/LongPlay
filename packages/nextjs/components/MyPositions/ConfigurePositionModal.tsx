import { useEffect, useMemo, useState } from "react";
import { Button } from "../Button";
import { Modal } from "../Modal";
import { TxStepper } from "../TxStepper";
import { Currency, Price } from "@uniswap/sdk-core";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { priceToClosestTick, tickToPrice } from "@uniswap/v4-sdk";
import { parseUnits } from "viem";
import { MOCK_POOL_ID } from "~~/contracts/deployedContracts";
import { useChainId } from "~~/hooks/useChainId";
import { useConfigurePosition } from "~~/hooks/useConfigurePosition";
import { StrategyId } from "~~/types/avs.types";
import { STRATEGY_LABELS_TO_DESCRIPTION } from "~~/types/avs.types";
import { StepState } from "~~/types/tx-types";
import { PositionStored, updatePosition } from "~~/utils/localStorage";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

interface ConfigurePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPosition: PositionStored | null;
  setSelectedPosition: (position: PositionStored | null) => void;
  strategyId: number;
  setStrategyId: (id: number) => void;
  baseCurrency?: Currency;
  quoteCurrency?: Currency;
  tickSpacing?: number;
}
export const ConfigurePositionModal = ({
  isOpen,
  onClose,
  selectedPosition,
  setSelectedPosition,
  strategyId,
  setStrategyId,
  baseCurrency,
  quoteCurrency,
  tickSpacing,
}: ConfigurePositionModalProps) => {
  const description = STRATEGY_LABELS_TO_DESCRIPTION[strategyId] ?? "";
  const [priceInput, setPriceInput] = useState<string>("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickThreshold, setTickThreshold] = useState<string>("0");
  const chainId = useChainId();

  const { configureAction } = useConfigurePosition();

  const handleSubmitConfigure = async () => {
    if (!selectedPosition) return;
    if (!tickSpacing) {
      throw new Error("Pool tick spacing not found");
    }

    setIsSubmitting(true);
    setSteps(initialSteps);
    try {
      const parsedTick = Number(tickThreshold);
      const userConfig = await configureAction({
        tickThreshold: parsedTick,
        strategyId,
        positionId: selectedPosition.tokenId,
        posM: getContractsData(chainId).PositionManager,
        tickSpacing: tickSpacing,
        onProgress: (step, status, meta) => {
          setStep(step, { status, ...meta });
        },
      });

      if (!userConfig) {
        console.log("User config not found");
        return;
      }

      console.log("User config found", userConfig);

      updatePosition(MOCK_POOL_ID, {
        ...selectedPosition,
        userConfig,
        isManaged: true,
      });
      onClose();
      setSelectedPosition(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialSteps: StepState[] = [
    { id: "approval", label: "Approve position manager", status: "idle" },
    { id: "configure", label: "Configure position", status: "idle" },
  ];
  const [steps, setSteps] = useState<StepState[]>([]);
  const setStep = (id: StepState["id"], patch: Partial<StepState>) =>
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  useEffect(() => {
    setSteps([]);
  }, [isOpen]);

  const derivedTickInfo = useMemo(() => {
    try {
      if (!baseCurrency || !quoteCurrency || !tickSpacing) return null;
      if (!priceInput || Number(priceInput) <= 0) return null;

      // raw amounts (unadjusted for decimals)
      const denom = 10n ** BigInt(baseCurrency.decimals);
      const numer = parseUnits(priceInput, quoteCurrency.decimals);

      const price = new Price(baseCurrency, quoteCurrency, denom.toString(), numer.toString());
      const rawTick = priceToClosestTick(price);
      const usableTick = nearestUsableTick(rawTick, tickSpacing);

      const snappedPrice = tickToPrice(baseCurrency, quoteCurrency, usableTick).toSignificant(6);

      return { rawTick, usableTick, snappedPrice };
    } catch {
      return null;
    }
  }, [baseCurrency, quoteCurrency, tickSpacing, priceInput]);

  useEffect(() => {
    if (!isOpen) return;
    if (derivedTickInfo?.usableTick !== undefined) {
      setTickThreshold(String(derivedTickInfo.usableTick));
    }
  }, [derivedTickInfo?.usableTick, isOpen, setTickThreshold]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Position${selectedPosition ? ` #${selectedPosition.tokenId}` : ""}`}
      footer={
        <>
          <Button onClick={onClose} rounded="lg" variant="secondary">
            Cancel
          </Button>

          <Button onClick={handleSubmitConfigure} rounded="lg" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Configuring..." : "Confirm"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price ({baseCurrency?.symbol ?? "Base"}/{quoteCurrency?.symbol ?? "Quote"})
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
              placeholder="e.g. 3000"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Interpreted as {quoteCurrency?.symbol ?? "quote"} per 1 {baseCurrency?.symbol ?? "base"}.
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-700">Tick from price: </span>
            <span className="font-medium">{derivedTickInfo ? `≈ ${derivedTickInfo.usableTick}` : "—"}</span>
            {derivedTickInfo && (
              <>
                <span className="text-gray-400"> • </span>
                <span className="text-gray-600">(rounded price @ tick: {derivedTickInfo.snappedPrice})</span>
                <button
                  type="button"
                  className="ml-2 text-xs px-2 py-1 border rounded-md hover:bg-gray-50"
                  onClick={() => setTickThreshold(String(derivedTickInfo.usableTick))}
                >
                  Use this tick
                </button>
              </>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
          <div className="grid grid-cols-1 gap-3">
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                strategyId === StrategyId.Asset0ToAave
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="strategy"
                className="mt-1"
                checked={strategyId === StrategyId.Asset0ToAave}
                onChange={() => setStrategyId(StrategyId.Asset0ToAave)}
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Asset 0 to Aave</div>
                <div className="text-xs text-gray-500">{STRATEGY_LABELS_TO_DESCRIPTION[StrategyId.Asset0ToAave]}</div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                strategyId === StrategyId.None ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="strategy"
                className="mt-1"
                checked={strategyId === StrategyId.None}
                onChange={() => setStrategyId(StrategyId.None)}
              />
              <div>
                <div className="text-sm font-medium text-gray-900">No strategy</div>
                <div className="text-xs text-gray-500">{STRATEGY_LABELS_TO_DESCRIPTION[StrategyId.None]}</div>
              </div>
            </label>
          </div>
        </div>

        {steps.length > 0 && (
          <div className="rounded-lg bg-gray-50 p-3">
            <TxStepper steps={steps} />
          </div>
        )}

        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <span className="font-medium">Summary: </span>
          <span>{description}</span>
        </div>
      </div>
    </Modal>
  );
};
