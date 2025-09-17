import { Button } from "../Button";
import { useSwapMock } from "~~/hooks/useSwapMock";

interface ISwapMockProps {
  service: string | undefined;
}

export const SwapMock = ({ service }: ISwapMockProps) => {
  const { handleSwapAction, isDisabled } = useSwapMock();

  const buttonTextNoService = "Service Not Set";

  return (
    <div className="flex flex-col gap-2 p-4 border border-gray-300 rounded-md w-fit shadow-md my-4 min-h-[155px]">
      <span className="text-center font-bold">Swap Helpers:</span>
      <Button
        disabled={isDisabled || !service}
        onClick={async () => {
          handleSwapAction({ zeroForOne: true, amountReadable: "10" });
        }}
        className="w-fit"
      >
        {!service ? buttonTextNoService : `(Exact In) 10 Token0 --> Token1`}
      </Button>

      <Button
        disabled={isDisabled || !service}
        onClick={() => {
          handleSwapAction({ zeroForOne: false, amountReadable: "10" });
        }}
        className="w-fit"
      >
        {!service ? buttonTextNoService : `Token0 <-- 10 Token1 (Exact In)`}
      </Button>
    </div>
  );
};
