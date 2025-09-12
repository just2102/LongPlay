import { Button } from "../Button";
import { useSwapMock } from "~~/hooks/useSwapMock";

export const SwapMock = () => {
  const { handleSwapAction, isDisabled } = useSwapMock();

  return (
    <div className="flex flex-col gap-2 p-4 border border-gray-300 rounded-md w-fit shadow-md my-4 mx-auto">
      <span className="text-center font-bold">Swap Helpers:</span>
      <Button
        disabled={isDisabled}
        onClick={async () => {
          handleSwapAction({ zeroForOne: true, amountReadable: "100" });
        }}
        className="w-fit"
      >
        (Exact In) 100 Token0 --&gt; Token1
      </Button>

      <Button
        disabled={isDisabled}
        onClick={() => {
          handleSwapAction({ zeroForOne: false, amountReadable: "100" });
        }}
        className="w-fit"
      >
        Token0 &lt;-- 100 Token1 (Exact In)
      </Button>
    </div>
  );
};
