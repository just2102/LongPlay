import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { Pool } from "@uniswap/v4-sdk";
import { erc20Abi, maxUint160, maxUint256, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { useChainId } from "~~/hooks/useChainId";
import { useMintPosition } from "~~/hooks/useMintPosition";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { getContractsData } from "~~/utils/scaffold-eth/contract";

const getSwapConfig = (pool: Pool, amountReadable: string, zeroForOne: boolean) => {
  if (!pool) {
    return null;
  }

  return {
    poolKey: pool.poolKey,
    zeroForOne,
    amountIn: parseUnits(amountReadable, pool?.token0.decimals).toString(),
    amountOutMinimum: "0",
    hookData: "0x00",
  };
};

interface SwapActionParams {
  zeroForOne: boolean;
  amountReadable: string;
}

export const useSwapMock = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { pool } = useMintPosition();

  const handleSwapAction = async ({ zeroForOne, amountReadable }: SwapActionParams) => {
    if (!pool || !address) {
      return;
    }

    const config = getSwapConfig(pool, amountReadable, zeroForOne);
    if (!config) {
      return;
    }

    const currencyIn = zeroForOne ? config.poolKey.currency0 : config.poolKey.currency1;
    const currencyOut = zeroForOne ? config.poolKey.currency1 : config.poolKey.currency0;

    console.log(config);

    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [config]);
    v4Planner.addAction(Actions.SETTLE_ALL, [currencyIn, config.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [currencyOut, config.amountOutMinimum]);

    const encodedActions = v4Planner.finalize();
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
    const uniRouter = getContractsData(chainId).UniRouter;

    // Only needed for native ETH as input currency swaps
    const isNativeEthSwap = false;
    const currency = zeroForOne ? pool.currency0 : pool.currency1;

    if (!isNativeEthSwap && !currency.isNative) {
      const permit2 = getContractsData(chainId).Permit2;

      const hasApprovedErc20 = await readContract(wagmiConfig, {
        address: currency.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, permit2.address],
      });
      console.log("Has approved Erc20:", hasApprovedErc20);

      if (!hasApprovedErc20 || hasApprovedErc20 < BigInt(config.amountIn)) {
        try {
          const tx1 = await writeContract(wagmiConfig, {
            address: currency.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [permit2.address, maxUint256],
          });

          console.log("Erc20 approval tx:", tx1);
        } catch (error) {
          console.error(error);
          return;
        }
      }

      const [amountApprovedPermit2, deadlinePermit2] = await readContract(wagmiConfig, {
        address: permit2.address,
        abi: permit2.abi,
        functionName: "allowance",
        args: [address, currency.address, uniRouter.address],
      });
      const isDeadlineExpiredPermit2 = deadlinePermit2 < Math.floor(Date.now() / 1000);

      if (!amountApprovedPermit2 || amountApprovedPermit2 < BigInt(config.amountIn) || isDeadlineExpiredPermit2) {
        try {
          const tx2 = await writeContract(wagmiConfig, {
            address: permit2.address,
            abi: permit2.abi,
            functionName: "approve",
            args: [currency.address, uniRouter.address, maxUint160, deadline],
          });
          console.log("Permit2 approval tx:", tx2);
        } catch (error) {
          console.error(error);
          return;
        }
      }
    }

    try {
      const tx = await writeContract(wagmiConfig, {
        abi: uniRouter.abi,
        address: uniRouter.address,
        functionName: "execute",
        args: [routePlanner.commands, [encodedActions], BigInt(deadline)],
        value: isNativeEthSwap ? BigInt(config.amountIn) : undefined,
      });

      console.log(tx);

      await waitForTransactionReceipt(wagmiConfig, {
        hash: tx,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const isDisabled = !pool || !address;

  return {
    handleSwapAction,
    isDisabled,
  };
};
