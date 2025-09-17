import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x590b1AfEa1782B4Bcf6C84f94F6c2aE090769461";
export const MOCK_CURRENCY1 = "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5";
export const MOCK_POOL_ID = "0x2309f7d697f5b7cf39b4401f20927d680c323dce9318cf97aa3a315d32602ef0";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0x40D0e2B72a341b538057A1FaE1ADD1EafF9B9440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x678f3915f325ac1567af89d533229e434a9c3834",
      abi: avsAbi,
    },
  },
  11155111: {
    LPRebalanceHook: {
      address: "0x6E126F1E9Db9e7d0ECce19efF10806A96e9b1440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x9993c6ec14e5ed8fc63e9285d7ffc846a2fd95c4",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
