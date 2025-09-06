import { useAccount } from "wagmi";
import { contractsData } from "~~/utils/scaffold-eth/contract";

export const useChainId = () => {
  const { chainId } = useAccount();
  return (chainId ?? 1) as keyof typeof contractsData;
};
