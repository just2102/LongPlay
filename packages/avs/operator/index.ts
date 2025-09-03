import { ethers, NonceManager } from "ethers";
import * as dotenv from "dotenv";
const fs = require("fs");
const path = require("path");
dotenv.config();

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
  throw new Error("process.env object is empty");
}

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const walletUnmanaged = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const wallet = new NonceManager(walletUnmanaged);

/// TODO: Hack
let chainId = 1;

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

// Minimal ABI for LPRebalanceHook we need: event + withdrawLiquidity
const HOOK_ABI = [
  {
    type: "event",
    name: "WithdrawNeeded",
    inputs: [
      { name: "lastTick", type: "int24", indexed: true },
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "tickSpacing", type: "int24" },
      { name: "fee", type: "uint24" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "withdrawLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "posManagerAddress", type: "address" },
      { name: "lastTick", type: "int24" },
    ],
    outputs: [],
  },
];
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

const hookAddress = process.env.LP_REBALANCE_HOOK_ADDRESS!;
if (!hookAddress) {
  throw new Error(
    "LP_REBALANCE_HOOK_ADDRESS not found in environment variables"
  );
}

const positionManagerAddress = process.env.POSITION_MANAGER_ADDRESS!; // todo: keep a mapping of position managers on supported chains
if (!positionManagerAddress) {
  throw new Error(
    "POSITION_MANAGER_ADDRESS not found in environment variables"
  );
}
const hook = new ethers.Contract(hookAddress, HOOK_ABI, wallet);

const submitWithdrawLiquidity = async (
  lastTick: number | bigint,
  currency0: string,
  currency1: string,
  fee: number | bigint,
  tickSpacing: number | bigint
) => {
  const key = {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks: hookAddress,
  };

  console.log("Submitting withdrawLiquidity:", {
    key,
    lastTick: Number(lastTick),
  });
  const tx = await hook.withdrawLiquidity(
    key,
    positionManagerAddress,
    lastTick
  );
  const receipt = await tx.wait();
  console.log("withdrawLiquidity confirmed in", receipt.hash);
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

const monitorNewTasks = async () => {
  if (!hook) throw new Error("No hook contract instance");
  hook.on(
    "WithdrawNeeded",
    async (lastTick, currency0, currency1, tickSpacing, fee, event) => {
      console.log("WithdrawNeeded received:", {
        lastTick: Number(lastTick),
        currency0,
        currency1,
        fee: Number(fee),
        tickSpacing: Number(tickSpacing),
        blockNumber: event.blockNumber,
        txHash: event.log.transactionHash,
      });
      try {
        await submitWithdrawLiquidity(
          lastTick,
          currency0,
          currency1,
          fee,
          tickSpacing
        );
      } catch (e) {
        console.error("withdrawLiquidity failed:", e);
      }
    }
  );

  console.log("Monitoring for WithdrawNeeded events...");
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
