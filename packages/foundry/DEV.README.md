# USDC Funding for USDC Pool testing (local fork):

1. `cast rpc anvil_impersonateAccount ${USDC_WHALE} --rpc-url localhost:8545`;

2. `cast send ${USDC_ADDRESS} "transfer(address,uint256)" ${USER} 10000000000 --from ${USDC_WHALE} --rpc-url localhost:8545 --unlocked`;

3. `forge script script/LocalDeploySetupUSDC.s.sol --rpc-url localhost:8545 --private-key {$USER_PK} --broadcast`

# Testing with Sepolia:

1. Go to Aave faucet (GHO Sepolia Market): https://gho.aave.com/faucet/ and get some USDC (0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8)
2. `forge script script/SepoliaDeploySetup.s.sol --broadcast --rpc-url ${RPC_URL} --private-key {$USER_PK}`
