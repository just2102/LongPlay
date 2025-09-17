import { ethers, NonceManager } from "ethers";
import * as dotenv from "dotenv";
import { Task, UserConfig } from "./types";
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
import { computeThresholdBounds } from "./bounds";
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
  getGasPrice,
  getTransactionCount,
  simulateContract,
  getBlockNumber,
} from "viem/actions";
import { jsonRpc } from "viem/nonce";
import { getChain } from "./chain";
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
const provider = new ethers.WebSocketProvider(process.env.WS_URL!);
const walletUnmanaged = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const wallet = new NonceManager(walletUnmanaged);

const nonceManager: NonceManagerViem = createNonceManager({
  source: jsonRpc(),
});
const account = privateKeyToAccount(process.env.PRIVATE_KEY! as Address, {
  nonceManager,
});
const chain = getChain();

const rpcUrl = process.env.RPC_URL! as string;
export const walletClient = createWalletClient({
  account: account,
  transport: http(rpcUrl),
  chain: chain,
});

// todo: deploy this contract
const avsDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../deployments/service/${chain.id}.json`),
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
    path.resolve(__dirname, `../deployments/core/${chain.id}.json`),
    "utf8"
  )
);

const delegationManagerAddress = coreDeploymentData.addresses.delegationManager; // todo: reminder to fix the naming of this contract in the deployment file, change to delegationManager
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const rangeExitManagerServiceAddress = avsDeploymentData.addresses.service;
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

const hook = new ethers.Contract(hookAddress, hookAbi, wallet);

const discoverValidPositions = async (
  minTick: number | string,
  maxTick: number | string
) => {
  const cfgIds = await redis.zrangebyscore("cfgs:thresholds", minTick, maxTick);
  console.log("Valid position cfg ids:", cfgIds);
  return cfgIds;
};

const registerOperator = async () => {
  // Registers as an Operator in EigenLayer.

  try {
    console.log("Requesting nonce");
    const nonce = await getTransactionCount(walletClient, {
      address: walletClient.account.address,
    });
    console.log("Nonce:", nonce);

    const gasPrice = await getGasPrice(walletClient);
    console.log("Gas price:", gasPrice);
    const { request } = await simulateContract(walletClient, {
      address: delegationManagerAddress, // Sepolia
      abi: delegationManagerABI,
      functionName: "registerAsOperator",
      args: ["0x0000000000000000000000000000000000000000", 0, ""],
      account,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await waitForTransactionReceipt(walletClient, { hash });
    console.log("Receipt:", receipt);

    console.log(
      "Operator successfully registered to Core EigenLayer contracts"
    );
  } catch (error) {
    if (
      "metaMessages" in error &&
      error.metaMessages.toString().includes("ActivelyDelegated")
    ) {
      console.log(
        "Operator already registered to Core EigenLayer contracts, proceeding"
      );
    } else {
      console.error("Error in registering as operator:", error);
      throw error;
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

  console.log("Requesting operator digest hash from AVS Directory contract");
  console.log("Avs directory contract: ", avsDirectoryAddress);
  console.log("Operator address: ", walletUnmanaged.address);
  console.log("Avs address: ", rangeExitManagerServiceAddress);
  console.log("Salt: ", salt);
  console.log("Expiry: ", expiry);
  const operatorDigestHash =
    await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
      walletUnmanaged.address,
      rangeExitManagerServiceAddress,
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

  try {
    // Register Operator to AVS
    // Per release here: https://github.com/Layr-Labs/eigenlayer-middleware/blob/v0.2.1-mainnet-rewards/src/unaudited/ECDSAStakeRegistry.sol#L49
    const tx2 = await walletClient.writeContract({
      address: ecdsaStakeRegistryAddress,
      abi: ecdsaRegistryABI,
      functionName: "registerOperatorWithSignature",
      account: account,
      chain,
      args: [operatorSignatureWithSaltAndExpiry, walletUnmanaged.address],
    });

    console.log("Tx2:", tx2);
    await waitForTransactionReceipt(walletClient, {
      hash: tx2,
    });
    console.log("Operator registered on AVS successfully");
  } catch (err) {
    if (
      "metaMessages" in err &&
      err.metaMessages.toString().includes("OperatorAlreadyRegistered")
    ) {
      console.log("Operator already registered, proceeding");
    } else {
      console.error("Error in registering as operator with signature:", err);
      throw err;
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
  // Use task.createdBlock to satisfy contract equality check, but wait until head > referenceBlock for registry
  const referenceBlock = BigInt(task.createdBlock);
  let head = await getBlockNumber(walletClient);
  while (head <= referenceBlock) {
    await new Promise((r) => setTimeout(r, 1200));
    head = await getBlockNumber(walletClient);
  }
  const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address[]", "bytes[]", "uint32"],
    [operators, signatures, Number(referenceBlock)]
  );
  console.log(
    "Signed task, sending withdrawLiquidity tx to RangeExitManagerService"
  );

  const args = [
    task as unknown,
    BigInt(taskIndex),
    configs as unknown[],
    signedTask,
  ];

  const nonce = await getTransactionCount(walletClient, {
    address: walletClient.account.address,
  });

  const gasPrice = await getGasPrice(walletClient);

  const hash = await writeContract(walletClient, {
    address: rangeExitManagerServiceAddress,
    abi: rangeExitManagerServiceABI,
    functionName: "withdrawLiquidity",
    account: account,
    args: args,
    nonce: nonce,
    type: "eip1559",
    maxFeePerGas: gasPrice * 2n,
    maxPriorityFeePerGas: gasPrice * 2n,
  });

  const receipt = await waitForTransactionReceipt(walletClient, {
    hash,
  });

  console.log("WithdrawLiquidity tx sent to RangeExitManagerService", receipt);

  console.log("WithdrawLiquidity tx sent to RangeExitManagerService");
};

const monitorNewTasks = async () => {
  if (!hook) throw new Error("No hook contract instance");
  if (!rangeExitManagerService)
    throw new Error("No rangeExitManagerService contract instance");
  console.log("Monitoring new tasks");
  console.log(
    "RangeExitManagerService address:",
    rangeExitManagerServiceAddress
  );
  console.log("Hook address:", hookAddress);

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

      const tickSpacing = Number(
        (poolKey && (poolKey.tickSpacing ?? poolKey[3])) ?? 0
      );
      const { min, max, empty } = computeThresholdBounds(
        Number(currentTick),
        Number(lastTick),
        tickSpacing
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
      console.log("Configs length:", configs.length);
      const normalizedTask = normalizeTaskFromEvent(task);
      console.log("Normalized task:", normalizedTask);

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
        await removeConfig(positionId.toString());
        console.log("[avs] delegation cancelled confirmed", {
          positionId: positionId.toString(),
        });
      } catch (e) {
        console.error("[avs] delegation cancelled failed:", e);
      }
    }
  );

  rangeExitManagerService.on(
    "PositionBurned",
    async (positionId, owner, config: UserConfig) => {
      console.log("PositionBurned received:", { positionId, owner, config });

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
  );

  rangeExitManagerService.on(
    "SupplySuccess",
    async (currency, amount, owner) => {
      console.log("SupplySuccess received:", { currency, amount, owner });
    }
  );

  rangeExitManagerService.on(
    "SupplyFailed",
    async (currency, amount, owner) => {
      console.log("SupplyFailed received:", { currency, amount, owner });
    }
  );

  console.log("Monitoring for events...");
};

const main = async () => {
  try {
    await registerOperator();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  monitorNewTasks().catch((error) => {
    console.error("Error monitoring tasks:", error);
  });
};

main().catch((error) => {
  console.error("Error in main function:", error);
});
