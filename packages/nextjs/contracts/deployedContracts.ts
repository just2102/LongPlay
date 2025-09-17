import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x9393585b1088DBD700eee32496BA7bAe4504cB59";
export const MOCK_CURRENCY1 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const MOCK_POOL_ID = "0x6eebed24ccf11b9ed8af8078cd6b4610f0f64d8edca11adff498c3080fbc49f2";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0xd4ee3e104E47DDd514D81D84A0364D9429aDd440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x917b242588f3b78e682d9e6f1e32977ac7e7b904",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
