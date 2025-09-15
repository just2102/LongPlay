import { ethers, NonceManager } from "ethers";
import * as dotenv from "dotenv";
import { StrategyId, Task, UserConfig } from "./types";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  saveConfig,
  getPendingEligible,
  markPending,
  clearPending,
  getConfigsByIds,
  removeConfig,
} from "./storage";
import { redis } from "./Redis";
import {
  Address,
  createNonceManager,
  createWalletClient,
  http,
  NonceManager as NonceManagerViem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  waitForTransactionReceipt,
  writeContract,
  readContract,
} from "viem/actions";
import { hardhat } from "viem/chains";
import { jsonRpc } from "viem/nonce";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
  throw new Error("process.env object is empty");
}

if (!process.env.RPC_URL) {
  throw new Error("RPC_URL not found in environment variables");
}
if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not found in environment variables");
}

// Setup env variables
// todo: replace ethers with viem
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const walletUnmanaged = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const wallet = new NonceManager(walletUnmanaged);

const nonceManager: NonceManagerViem = createNonceManager({
  source: jsonRpc(),
});
const account = privateKeyToAccount(process.env.PRIVATE_KEY! as Address, {
  nonceManager,
});
const chain = hardhat;

const rpcUrl = process.env.RPC_URL! as string;
const walletClient = createWalletClient({
  account: account,
  transport: http(rpcUrl),
  chain: chain,
});

let chainId = hardhat.id;

// todo: deploy this contract
const avsDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../deployments/service/${chainId}.json`),
    "utf8"
  )
);
if (!avsDeploymentData.addresses.stakeRegistry) {
  throw new Error("Stake registry address not found in deployment data");
}

// Load core deployment data
// todo: add type-safety for ABIs
const coreDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../deployments/core/${chainId}.json`),
    "utf8"
  )
);

const delegationManagerAddress = coreDeploymentData.addresses.delegationManager; // todo: reminder to fix the naming of this contract in the deployment file, change to delegationManager
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
// todo: rename
const rangeExitManagerServiceAddress =
  avsDeploymentData.addresses.helloWorldServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs
const delegationManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "./abis/IDelegationManager.json"),
    "utf8"
  )
);
const ecdsaRegistryABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "./abis/ECDSAStakeRegistry.json"),
    "utf8"
  )
);
const rangeExitManagerServiceABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "./abis/RangeExitManagerService.json"),
    "utf8"
  )
);

const hookAbi = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "./abis/LPRebalanceHook.abi.json"),
    "utf8"
  )
);

const avsDirectoryABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "./abis/IAVSDirectory.json"), "utf8")
);

// Initialize contract objects from ABIs
const delegationManager = new ethers.Contract(
  delegationManagerAddress,
  delegationManagerABI,
  wallet
);
const rangeExitManagerService = new ethers.Contract(
  rangeExitManagerServiceAddress,
  rangeExitManagerServiceABI,
  wallet
);
const ecdsaRegistryContract = new ethers.Contract(
  ecdsaStakeRegistryAddress,
  ecdsaRegistryABI,
  wallet
);
const avsDirectory = new ethers.Contract(
  avsDirectoryAddress,
  avsDirectoryABI,
  wallet
);

const hookAddress = process.env.HOOK_ADDRESS;
if (!hookAddress) {
  throw new Error("HOOK_ADDRESS not found in environment variables");
}

const positionManagerAddress = process.env.POSITION_MANAGER_ADDRESS!; // todo: keep a mapping of position managers on supported chains
if (!positionManagerAddress) {
  throw new Error(
    "POSITION_MANAGER_ADDRESS not found in environment variables"
  );
}
const hook = new ethers.Contract(hookAddress, hookAbi, wallet);

const discoverValidPositions = async (
  minTick: number | string,
  maxTick: number | string
) => {
  const cfgIds = await redis.zrangebyscore("cfgs:thresholds", minTick, maxTick);
  console.log("Valid position cfg ids:", cfgIds);
  return cfgIds;
};

/**
 * 
 @notice Determine search bounds for tick thresholds between lastTick and currentTick.
 @notice Rules:
 * - If price moved up (current > last): search [lastTick, currentTick)
 * - If price moved down (current < last): search (currentTick, lastTick]
 * - If unchanged: return empty range
 */
const computeThresholdBounds = (
  currentTick: number,
  lastTick: number
): { min: string | number; max: string | number; empty: boolean } => {
  if (currentTick === lastTick) {
    return { min: 0, max: 0, empty: true };
  }

  if (currentTick > lastTick) {
    // [last, current)
    return { min: lastTick, max: `(${currentTick}`, empty: false };
  }

  // (current, last]
  return { min: `(${currentTick}`, max: lastTick, empty: false };
};

const registerOperator = async () => {
  // Registers as an Operator in EigenLayer.

  try {
    const tx1 = await delegationManager.registerAsOperator(
      "0x0000000000000000000000000000000000000000", // initDelegationApprover
      0, // allocationDelay
      "" // metadataURI
    );

    await tx1.wait();
    console.log(
      "Operator successfully registered to Core EigenLayer contracts"
    );
  } catch (error) {
    if (error.info.error.data === "0x77e56a06") {
      // ActivelyDelegated()
      console.log(
        "Operator already registered to Core EigenLayer contracts, proceeding"
      );
    } else {
      console.error("Error in registering as operator:", error);
    }
  }

  const salt = ethers.hexlify(ethers.randomBytes(32));
  const expiry = Math.floor(Date.now() / 1000) + 3600; // Example expiry, 1 hour from now

  // Define the output structure
  let operatorSignatureWithSaltAndExpiry = {
    signature: "",
    salt: salt,
    expiry: expiry,
  };

  // Calculate the digest hash, which is a unique value representing the operator, avs, unique value (salt) and expiration date.
  const operatorDigestHash =
    await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
      walletUnmanaged.address,
      await rangeExitManagerService.getAddress(),
      salt,
      expiry
    );
  console.log(operatorDigestHash);

  // Sign the digest hash with the operator's private key
  console.log("Signing digest hash with operator's private key");
  const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
  const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

  // Encode the signature in the required format
  operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(
    operatorSignedDigestHash
  ).serialized;

  console.log("Registering Operator to AVS Registry contract");

  const nonce = await provider.getTransactionCount(
    walletUnmanaged.address,
    "pending"
  );

  try {
    // Register Operator to AVS
    // Per release here: https://github.com/Layr-Labs/eigenlayer-middleware/blob/v0.2.1-mainnet-rewards/src/unaudited/ECDSAStakeRegistry.sol#L49
    const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
      operatorSignatureWithSaltAndExpiry,
      walletUnmanaged.address,
      {
        nonce: nonce,
      }
    );
    await tx2.wait();
    console.log("Operator registered on AVS successfully");
  } catch (err) {
    if (err.info.error.data === "0x42ee68b5") {
      // OperatorAlreadyRegistered()
      console.log("Operator already registered, proceeding");
    } else {
      console.error("Error in registering as operator:", err);
    }
  }
};

function normalizeTaskFromEvent(task: any): Task {
  const key = task.poolKey ?? task[0];
  const poolKey = {
    currency0: key.currency0 ?? key[0],
    currency1: key.currency1 ?? key[1],
    fee: BigInt(key.fee ?? key[2]),
    tickSpacing: BigInt(key.tickSpacing ?? key[3]),
    hookAddress: key.hookAddress ?? key[4],
  };
  const lastTick = BigInt(task.lastTick ?? task[1]);
  const deadline = BigInt(task.deadline ?? task[2]);
  const createdBlock = BigInt(task.createdBlock ?? task[3]);
  return { poolKey, lastTick, deadline, createdBlock };
}

const signAndRespondToTask = async (
  task: Task,
  taskIndex: bigint | number,
  configs: UserConfig[]
) => {
  const messageHash = ethers.solidityPackedKeccak256(
    ["string", "int24"],
    ["Hello, ", task.lastTick]
  );
  const messageBytes = ethers.getBytes(messageHash);
  const signature = await wallet.signMessage(messageBytes);
  const signatures = [signature];

  const operators = [await wallet.getAddress()];
  const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address[]", "bytes[]", "uint32"],
    [operators, signatures, task.createdBlock]
  );

  writeContract(walletClient, {
    address: rangeExitManagerServiceAddress,
    abi: rangeExitManagerServiceABI,
    functionName: "withdrawLiquidity",
    account: account,
    chain,
    args: [task as unknown, taskIndex, configs as unknown[], signedTask],
  });
};

// Flow: price change on Uniswap
// 1) listen to hook WithdrawNeeded
// 2) determine valid positions via database query
// 3) call AVS contract to modify positions (batch)
const monitorNewTasks = async () => {
  if (!hook) throw new Error("No hook contract instance");
  if (!rangeExitManagerService)
    throw new Error("No rangeExitManagerService contract instance");

  rangeExitManagerService.on(
    "WithdrawNeeded",
    async (task, taskIndex, poolKey, lastTick, deadline, poolId) => {
      console.log("WithdrawNeeded received:", {
        task,
        taskIndex,
        poolKey,
        lastTick,
        deadline,
        poolId,
      });

      const currentTick = await hook["getCurrentTick(bytes32)"](poolId);

      const { min, max, empty } = computeThresholdBounds(
        Number(currentTick),
        Number(lastTick)
      );

      if (empty) {
        console.log("Tick unchanged; no positions to discover");
        return;
      }

      const discovered = await discoverValidPositions(min, max);
      const pendingEligible = await getPendingEligible(
        Number(currentTick),
        Number(lastTick)
      );
      const cfgIds = Array.from(
        new Set([...(discovered || []), ...(pendingEligible || [])])
      );

      const configs = await getConfigsByIds(cfgIds);
      const normalizedTask = normalizeTaskFromEvent(task);

      try {
        await signAndRespondToTask(normalizedTask, taskIndex, configs);
        // TODO: after successful on-chain confirmation, clear pending for processed ids
        // for (const id of cfgIds) await clearPending(id);
      } catch (e) {
        console.error("withdrawLiquidity failed:", e);
        // Optionally mark all attempted ids as pending
        // for (const id of cfgIds) await markPending(id);
      }
    }
  );

  rangeExitManagerService.on(
    "PositionConfigured",
    async (tickThreshold: bigint, positionId: bigint, config: UserConfig) => {
      console.log("PositionConfigured received:", {
        tickThreshold,
        positionId,
        config,
      });

      try {
        const hash = await writeContract(walletClient, {
          address: rangeExitManagerServiceAddress,
          abi: rangeExitManagerServiceABI,
          functionName: "setPositionManaged",
          account: account,
          chain,
          args: [positionId, true],
        });

        const receipt = await waitForTransactionReceipt(walletClient, {
          hash,
        });

        console.log("[avs] setPositionManaged confirmed", {
          positionId: positionId.toString(),
          receipt: receipt,
        });
      } catch (e) {
        console.error("[avs] setPositionManaged failed:", e);
      }

      try {
        await saveConfig({
          owner: config.owner,
          positionId: positionId.toString(),
          tickThreshold: Number(tickThreshold),
          strategyId: Number(config.strategyId),
          posM: config.posM,
        });
        console.log("[redis] saved cfg", {
          positionId: positionId.toString(),
          tickThreshold: Number(tickThreshold),
        });
      } catch (e) {
        console.error("[redis] saveConfig failed:", e);
      }
    }
  );

  rangeExitManagerService.on(
    "DelegationCancelled",
    async (posM, positionId) => {
      console.log("DelegationCancelled received:", { positionId, posM });

      try {
        const hash = await writeContract(walletClient, {
          address: rangeExitManagerServiceAddress,
          abi: rangeExitManagerServiceABI,
          functionName: "setPositionManaged",
          account: account,
          chain,
          args: [positionId.toString(), false],
        });

        const receipt = await waitForTransactionReceipt(walletClient, {
          hash,
        });

        const isStillManaged = await readContract(walletClient, {
          address: rangeExitManagerServiceAddress,
          abi: rangeExitManagerServiceABI,
          functionName: "isPositionManaged",
          account: account,
          args: [positionId.toString()],
        });
        if (!isStillManaged) {
          await removeConfig(positionId.toString());
          console.log("[avs] setPositionManaged to false confirmed", {
            positionId: positionId.toString(),
            receipt: receipt,
          });
        } else {
          // addToPendingQueue, process later
        }
      } catch (e) {
        console.error("[avs] setPositionManaged to false failed:", e);
      }
    }
  );

  rangeExitManagerService.on(
    "PositionBurned",
    async (positionId, owner, config: UserConfig) => {
      console.log("PositionBurned received:", { positionId, owner, config });
      const strategy = Number(config.strategyId);

      if (strategy === StrategyId.None) {
        console.log(
          "Strategy None: removing config from storage",
          positionId.toString()
        );

        try {
          const hash = await writeContract(walletClient, {
            address: rangeExitManagerServiceAddress,
            abi: rangeExitManagerServiceABI,
            functionName: "setPositionManaged",
            account: account,
            chain,
            args: [positionId.toString(), false],
          });
          const receipt = await waitForTransactionReceipt(walletClient, {
            hash,
          });

          await removeConfig(positionId.toString());
          console.log("Position burned and unmanaged confirmed", {
            positionId: positionId.toString(),
            receipt: receipt,
          });
        } catch (e) {
          console.error(
            "Setting position managed status after burn to false failed:",
            e
          );
        }
        return;
      }

      if (strategy === StrategyId.Asset0ToAave) {
        console.log("Supplying asset 0 to aave");
        try {
          // todo: add logic to supply to aave
          const hash = await writeContract(walletClient, {
            address: rangeExitManagerServiceAddress,
            abi: rangeExitManagerServiceABI,
            functionName: "setPositionManaged",
            account: account,
            chain,
            args: [positionId.toString(), false],
          });
          const receipt = await waitForTransactionReceipt(walletClient, {
            hash,
          });

          await removeConfig(positionId.toString());
          console.log("Position supplied to aave and unmanaged confirmed", {
            positionId: positionId.toString(),
            receipt: receipt,
          });
        } catch (e) {
          console.error(
            "Setting position managed status after burn to false failed:",
            e
          );
        }
        return;
      }

      console.log("Unknown strategy, leaving config as-is");
    }
  );

  console.log("Monitoring for events...");
};

const main = async () => {
  await registerOperator();
  monitorNewTasks().catch((error) => {
    console.error("Error monitoring tasks:", error);
  });
};

main().catch((error) => {
  console.error("Error in main function:", error);
});
