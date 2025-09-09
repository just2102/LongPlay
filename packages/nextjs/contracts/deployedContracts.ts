import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x142458eE914CE315F040CdCE64647e08f482AB29";
export const MOCK_CURRENCY1 = "0x23DFBc4B8B80C14CC5e25011B8491f268395BAd6";
export const MOCK_POOL_ID = "0x038b3cfe5cfa29e5a276d9acf82dad5328864ec6d20938b027deed9642fc6a44";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0xB34e52bDd362015B06E98df77538a22730245440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x8169cc845e1df4f0381096b1668b1aa4a0c924b4",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
