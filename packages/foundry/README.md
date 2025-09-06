# Deploy hook:

`forge script script/Deploy.s.sol --rpc-url localhost:8545 --broadcast --private-key {$PRIVATE_KEY}`

# Set service:

`forge script script/SetService.s.sol --rpc-url localhost:8545 --broadcast --private-key {$PRIVATE_KEY}`

## Running tests:

1. Fork mainnet with the 31337 chain id to simplify frontend testing:
   `anvil --fork-url {MAINNET_RPC_URL} --fork-chain-id 31337 --fork-block-number 23302617`
2. Run tests:
   `forge test --rpc-url localhost:8545`

### Running tests with the frontend

1. Fork mainnet (`anvil --fork-url {MAINNET_RPC_URL}`)
2. Run `forge script script/DeploySetup.s.sol --rpc-url localhost:8545 --broadcast --private-key {$PRIVATE_KEY}`
   The deployed contracts will be written to `packages/foundry/deployments/{chainId}.json`
