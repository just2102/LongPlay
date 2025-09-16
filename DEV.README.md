## Deploying and running tests with the frontend

1. Fork mainnet (`anvil --fork-chain-id 31337 --fork-block-number 23302617 --fork-url {MAINNET_RPC_URL} `)
2. a. If you wish to test with mock token0 and mock token1, run:
   `cd packages/foundry && forge script script/DeploySetup.s.sol --rpc-url localhost:8545 --broadcast --private-key {$USER_PK}`
   b. If you wish to test with mainnet USDC as one of the tokens in the pool, run:
   `1. cast rpc anvil_impersonateAccount 0x37305b1cd40574e4c5ce33f8e8306be057fd7341 --rpc-url localhost:8545`
   `2. cast send 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 "transfer(address,uint256)" 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 10000000000 --from 0x37305b1cd40574e4c5ce33f8e8306be057fd7341 --rpc-url localhost:8545 --unlocked`
   `3. forge script script/DeploySetupUSDC.s.sol --rpc-url localhost:8545 --private-key {$USER_PK}`

   The deployed contracts will be written to `packages/foundry/deployments/{chainId}.json`

3. Run `yarn foundry:extract-hook-abi` in the root project folder to extract the hook ABI if needed.
   The ABI will be written to `packages/foundry/abis/LPRebalanceHook.json`

4. Go to packages/nextjs/contracts/deployedContracts.ts and add the deployed contracts to the `deployedContracts` object.
5. Run `yarn start` to start the frontend.

6. Deploy the AVS contract:
   `cd packages/avs && forge script script/DeployEigenLayerCore.s.sol --rpc-url http://localhost:8545 --broadcast --optimize --optimizer-runs 200 --via-ir`
   `cd packages/avs && forge script script/ServiceDeployer.s.sol --rpc-url http://localhost:8545 --broadcast --optimize --optimizer-runs 200 --via-ir`
   The deployed contracts will be written to `packages/avs/deployments/{chainId}.json`
7. Extract the ABI of the AVS contract:
   `yarn avs:extract-abi`
   The ABI will be written to `packages/avs/abis/RangeExitManagerService.abi.json`

8. Add envs to the packages/avs.env file, including the HOOK_ADDRESS
9. Run the operator:
   `cd packages/avs && yarn run operator`

### Additional scripts:

- Deploy hook:
  `cd packages/foundry && forge script script/Deploy.s.sol --rpc-url localhost:8545 --broadcast --private-key {$USER_PK}`

- Set service:
  `cd packages/foundry && forge script script/SetService.s.sol --rpc-url localhost:8545 --broadcast --private-key {$USER_PK}`

- Run tests:
  `cd packages/foundry && forge test --rpc-url localhost:8545`
