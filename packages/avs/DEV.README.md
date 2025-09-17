# Deployment (local):

`forge script script/DeployEigenLayerCore.s.sol --rpc-url http://localhost:8545 --broadcast --optimize --optimizer-runs 200 --via-ir`

`forge script script/ServiceDeployer.s.sol --rpc-url http://localhost:8545 --broadcast --optimize --optimizer-runs 200 --via-ir`

OR if you're lazy:
`yarn run deployAll`

# Starting the operator

`yarn run operator`
OR
`npx tsx operator/index.ts`

# Deployment (Sepolia):

`forge script script/DeployEigenLayerCore.s.sol --broadcast --optimize --optimizer-runs 200 --via-ir --rpc-url ${RPC_URL} --private-key ${PRIVATE_KEY}`

`forge script script/ServiceDeployer.s.sol --broadcast --optimize --optimizer-runs 200 --via-ir --rpc-url ${RPC_URL}`
