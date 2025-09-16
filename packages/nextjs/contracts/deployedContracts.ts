import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x466EabdDC6576f8C144A3c45b331F6808B43f407";
export const MOCK_CURRENCY1 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const MOCK_POOL_ID = "0xb0c40a98c83f1f2a1d945cae7331ed55d79771e338e88700ed227aedb2a00eb3";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0x3a5B764154328C0350b64Ebc42A21465434c9440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x23d089e15312fcfaa95ec110c83bb3397121084e",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
