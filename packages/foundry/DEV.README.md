# USDC Funding for USDC Pool testing:

1. `cast rpc anvil_impersonateAccount 0x37305b1cd40574e4c5ce33f8e8306be057fd7341 --rpc-url localhost:8545`;

2. `cast send 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 "transfer(address,uint256)" 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 10000000000 --from 0x37305b1cd40574e4c5ce33f8e8306be057fd7341 --rpc-url localhost:8545 --unlocked`;

3. `forge script script/DeploySetupUSDC.s.sol --rpc-url localhost:8545 --private-key {$USER_PK} --broadcast`
