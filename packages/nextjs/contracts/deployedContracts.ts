import { avsAbi } from "./abis/avs.abi";
import { hookAbi } from "./abis/hook.abi";
import { FeeAmount } from "@uniswap/v3-sdk";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

export const MOCK_CURRENCY0 = "0x0dbdd0ae11E26bCe2Bc40Ad97d02c2cEed24dC77";
export const MOCK_CURRENCY1 = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
export const MOCK_POOL_ID = "0x09c938fd35747dc0d5e9c5acf497c7a09655422c236c9c2391853b6c8c42199d";
export const MOCK_FEE = FeeAmount.MEDIUM;
export const MOCK_TICK_SPACING = 30;

const deployedContracts = {
  31337: {
    LPRebalanceHook: {
      address: "0x7cc97B2D955BFE255497eF4B544d1fBD7dFD5440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x678f3915f325ac1567af89d533229e434a9c3834",
      abi: avsAbi,
    },
  },
  11155111: {
    LPRebalanceHook: {
      address: "0x7cc97B2D955BFE255497eF4B544d1fBD7dFD5440",
      abi: hookAbi,
    },
    AVS: {
      address: "0x9678a3d2c56c341032c4f5b38a4bec5ddec19083",
      abi: avsAbi,
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
