// import { useAccount } from "wagmi";
import { contractsData } from "~~/utils/scaffold-eth/contract";

export const useChainId = () => {
  return 31337 as keyof typeof contractsData;
  // const { chainId } = useAccount();
  // return (chainId ?? 31337) as keyof typeof contractsData;
};
