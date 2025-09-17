import { Chain } from "viem";
import { hardhat, sepolia } from "viem/chains";

const chains: Record<number, Chain> = {
  31337: hardhat,
  11155111: sepolia,
};

export const getChain = (): Chain => {
  const chainId = process.env.CHAIN_ID;
  if (!chainId) {
    throw new Error("CHAIN_ID is not set");
  }

  const chain = chains[chainId];
  if (!chain) {
    throw new Error(`Chain with ID ${chainId} not supported`);
  }

  return chain;
};
