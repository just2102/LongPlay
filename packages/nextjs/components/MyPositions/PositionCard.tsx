import { Button } from "../Button";
import { CardBadge } from "./CardBadge";
import { PositionConfigInfo } from "./PositionConfigInfo";
import { Currency } from "@uniswap/sdk-core";
import { tickToPrice } from "@uniswap/v4-sdk";
import { useReadContract } from "wagmi";
import { useChainId } from "~~/hooks/useChainId";
import { PositionStored } from "~~/utils/localStorage";
import { Contract, getContractsData } from "~~/utils/scaffold-eth/contract";

interface PositionCardProps {
  position: PositionStored;
  handleConfigurePosition: (position: PositionStored) => void;
  handleCancelDelegation: ({
    positionId,
    posM,
  }: {
    positionId: number;
    posM: Contract<"PositionManager">;
  }) => Promise<void>;
  baseCurrency: Currency | undefined;
  quoteCurrency: Currency | undefined;
}

export const PositionCard = ({
  position,
  handleConfigurePosition,
  handleCancelDelegation,
  baseCurrency,
  quoteCurrency,
}: PositionCardProps) => {
  const isFullRangePosition = position.tickLower <= -887200 && position.tickUpper >= 887100;

  const chainId = useChainId();
  const contractData = getContractsData(chainId).AVS;
  const { data: isPositionManaged } = useReadContract({
    abi: contractData.abi,
    address: contractData.address,
    functionName: "isPositionManaged",
    args: [BigInt(position.tokenId)],
  });
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-6 
    shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 h-full flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Position #{position.tokenId}</h3>
          <p className="text-sm text-gray-500">Liquidity Position</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <CardBadge isActive={isPositionManaged} labelActive="Configured" labelInactive="Not Configured" />
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lower Tick</p>
            {isFullRangePosition ? (
              <p className="text-lg font-semibold text-gray-900">Full range</p>
            ) : (
              <>
                <p className="text-lg font-mono font-semibold text-gray-900">{position.tickLower}</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Price</p>
                <p
                  className={`text-lg font-mono font-semibold text-gray-900 
                  ${!baseCurrency || !quoteCurrency ? "animate-pulse opacity-80" : ""}
                  `}
                >
                  {baseCurrency &&
                    quoteCurrency &&
                    tickToPrice(baseCurrency, quoteCurrency, position.tickLower)?.toSignificant(6)}
                </p>
              </>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Upper Tick</p>
            {isFullRangePosition ? (
              <p className="text-lg font-semibold text-gray-900">Full range</p>
            ) : (
              <>
                <p className="text-lg font-mono font-semibold text-gray-900">{position.tickUpper}</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Price</p>
                <p
                  className={`text-lg font-mono font-semibold text-gray-900 
                  ${!baseCurrency || !quoteCurrency ? "animate-pulse opacity-80" : ""}
                  `}
                >
                  {baseCurrency &&
                    quoteCurrency &&
                    tickToPrice(baseCurrency, quoteCurrency, position.tickUpper)?.toSignificant(6)}
                </p>
              </>
            )}
          </div>
        </div>

        {position.userConfig && <PositionConfigInfo userConfig={position.userConfig} />}
      </div>

      <Button
        onClick={() => {
          if (isPositionManaged === undefined) return;

          if (isPositionManaged) {
            handleCancelDelegation({
              positionId: position.tokenId,
              posM: getContractsData(chainId).PositionManager,
            });
          } else {
            handleConfigurePosition({
              ...position,
              isManaged: !position.isManaged,
            });
          }
        }}
        className="w-full mt-auto"
        disabled={isPositionManaged === undefined}
        variant={isPositionManaged ? "secondary" : "primary"}
      >
        {isPositionManaged ? "Stop managing" : "Configure"}
      </Button>
    </div>
  );
};
