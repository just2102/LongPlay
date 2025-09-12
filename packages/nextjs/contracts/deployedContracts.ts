import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x606F8d5e36AF652DAdBc011bac916f6cb57e17eB";
export const MOCK_CURRENCY1 = "0xD36946666c25eC7f819D9CAEBDAEeF2156B43b98";
export const MOCK_POOL_ID = "0x03d7d8870a2fce8884052b438e4d6aefbd65f8e8e1430b68c0f2c708f247c596";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0xF166a820802431eC4524E6178d04f89016799440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x3d243f51bfa459bbd5f4739ffcc3de355887e17d",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
