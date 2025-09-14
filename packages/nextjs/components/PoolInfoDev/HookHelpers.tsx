import { Button } from "../Button";
import { useAccount, useWriteContract } from "wagmi";
import { useChainId } from "~~/hooks/useChainId";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

export const HookHelpers = () => {
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();
  return (
    <div className="flex flex-col gap-2 p-4 border border-gray-300 items-center justify-center rounded-md w-fit shadow-md my-4 min-h-[155px]">
      <span className="text-center font-bold">Hook Helpers:</span>

      <Button
        disabled={false}
        onClick={async () => {
          try {
            const hook = getContractsData(chainId).LPRebalanceHook;
            const avs = getContractsData(chainId).AVS;
            const tx = await writeContractAsync({
              address: hook.address,
              abi: hook.abi,
              functionName: "setService",
              args: [avs.address],
              account: address,
            });

            console.log("setService tx:", tx);
          } catch (error) {
            console.error(error);
          }
        }}
        className="w-fit"
      >
        Set Service
      </Button>
    </div>
  );
};
