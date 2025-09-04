# Deploy hook:

`forge script script/Deploy.s.sol --rpc-url localhost:8545 --broadcast --private-key {$PRIVATE_KEY}`

# Set service:

`forge script script/SetService.s.sol --rpc-url localhost:8545 --broadcast --private-key {$PRIVATE_KEY}`

## Running tests:

1. Fork mainnet
   `anvil --fork-url {MAINNET_RPC_URL}`
2. Run tests:
   `forge test --rpc-url localhost:8545`
