import { Button } from "../Button";
import { PositionStored } from "~~/utils/localStorage";

export const PositionCard = ({
  position,
  handleUpdatePosition,
}: {
  position: PositionStored;
  handleUpdatePosition: (position: PositionStored) => void;
}) => {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-6 
    shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Position #{position.tokenId}</h3>
          <p className="text-sm text-gray-500">Liquidity Position</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <CardBadge isActive={position.isManaged} labelActive="Configured" labelInactive="Not Configured" />
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lower Tick</p>
            <p className="text-lg font-mono font-semibold text-gray-900">{position.tickLower}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Upper Tick</p>
            <p className="text-lg font-mono font-semibold text-gray-900">{position.tickUpper}</p>
          </div>
        </div>
      </div>

      <Button
        onClick={() => {
          handleUpdatePosition({
            ...position,
            isManaged: !position.isManaged,
          });
        }}
        className="w-full"
      >
        Configure
      </Button>
    </div>
  );
};

interface CardBadgeProps {
  isActive: boolean;
  labelActive: string;
  labelInactive: string;
}
const CardBadge = ({ isActive, labelActive, labelInactive }: CardBadgeProps) => {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isActive ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
        }`}
      >
        {isActive ? labelActive : labelInactive}
      </span>
    </div>
  );
};
