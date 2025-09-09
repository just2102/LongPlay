## Deploying and running tests with the frontend

1. Fork mainnet (`anvil --fork-chain-id 31337 --fork-block-number 23302617 --fork-url {MAINNET_RPC_URL} `)
2. Run `cd packages/foundry && forge script script/DeploySetup.s.sol --rpc-url localhost:8545 --broadcast --private-key {$USER_PK}`
   The deployed contracts will be written to `packages/foundry/deployments/{chainId}.json`
3. Run `yarn foundry:extract-hook-abi` in the root project folder to extract the hook ABI if needed.
   The ABI will be written to `packages/foundry/abis/LPRebalanceHook.abi.json`

4. Go to packages/nextjs/contracts/deployedContracts.ts and add the deployed contracts to the `deployedContracts` object.
5. Run `yarn start` to start the frontend.

6. Deploy the AVS contract:
   `cd packages/avs && forge script script/DeployEigenLayerCore.s.sol --rpc-url http://localhost:8545 --broadcast --optimize --optimizer-runs 200 --via-ir`
   `cd packages/avs && forge script script/HelloWorldDeployer.s.sol --rpc-url http://localhost:8545 --broadcast --optimize --optimizer-runs 200 --via-ir`
   The deployed contracts will be written to `packages/avs/deployments/{chainId}.json`
7. Extract the ABI of the AVS contract:
   `yarn avs:extract-abi`
   The ABI will be written to `packages/avs/abis/RangeExitManagerService.abi.json`

### Additional scripts:

- Deploy hook:
  `cd packages/foundry && forge script script/Deploy.s.sol --rpc-url localhost:8545 --broadcast --private-key {$USER_PK}`

- Set service:
  `cd packages/foundry && forge script script/SetService.s.sol --rpc-url localhost:8545 --broadcast --private-key {$USER_PK}`

- Run tests:
  `cd packages/foundry && forge test --rpc-url localhost:8545`
