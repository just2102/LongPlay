import { permit2Abi } from "./abis/permit2.abi";
import { posmAbi } from "./abis/posm.abi";
import { stateViewAbi } from "./abis/stateView.abi";
import { uniRouterAbi } from "./abis/uniRouter.abi";
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
  31337: {
    StateView: {
      address: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
      abi: stateViewAbi,
    },
    PositionManager: {
      address: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
      abi: posmAbi,
    },
    Permit2: {
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      abi: permit2Abi,
    },
    UniRouter: {
      address: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af",
      abi: uniRouterAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
