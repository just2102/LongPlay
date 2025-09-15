import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x21A21fa613917600e9dDE4441920562bB6238DaE";
export const MOCK_CURRENCY1 = "0xE72B348bCA4DAAD3d8886342557d581B50Bf3971";
export const MOCK_POOL_ID = "0xb537d153926bab9c8ac7ac4440defb50c453f9407853144e9b697159ab6730e3";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0xbEb4c9B43424BDe06D17CAfA827b308D413Ed440",
      abi: hookAbi,
    },
    AVS: {
      address: "0xb0de6e861a20eaf193c6b0a7113341af384e4c02",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
