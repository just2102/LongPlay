import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x142458eE914CE315F040CdCE64647e08f482AB29";
export const MOCK_CURRENCY1 = "0x23DFBc4B8B80C14CC5e25011B8491f268395BAd6";
export const MOCK_POOL_ID = "0x7ce4ea882578f13cca94c8be4c90a8565da50cf7e7a870308a29cc2a2700f8f0";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0xcc7C3155a928cb2FB73B1899259BB0F863E2D440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x393f953291462a34ef3dc6ee33567a592af46c8a",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
