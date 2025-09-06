import { stateViewAbi } from "./abis/stateView.abi";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: {
 *       address: "0x...",
 *       abi: [...],
 *     },
 *   },
 * } as const;
 */
const externalContracts = {
  1: {
    StateView: {
      address: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
      abi: stateViewAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
