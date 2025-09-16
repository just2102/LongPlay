import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0xE22e8337d684F13F59C8d540f688882A96170f34";
export const MOCK_CURRENCY1 = "0xE55DAa4B3ed9F8e92aDA60fe952e303cD89790Aa";
export const MOCK_POOL_ID = "0xd365fe1f02fc1f9fafe3844a12272745b61cdcd77aed119ba9a3f4bb8be73bf5";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0x2c4c0A9ac6e02E916Bfdd08EC5519046D4075440",
      abi: hookAbi,
    },
    AVS: {
      address: "0xc97f61d15ce51aa16d056106df7f76aae3c64090",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
