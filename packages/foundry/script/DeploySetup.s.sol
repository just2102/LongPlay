// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import "forge-std/console2.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {LPRebalanceHook} from "../src/LPRebalanceHook.sol";

import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {MockV4Router} from "v4-periphery/test/mocks/MockV4Router.sol";
import {IV4Router} from "v4-periphery/src/interfaces/IV4Router.sol";

import "forge-std/console.sol";

contract DeploySetup is Script {
    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);
    address constant DEFAULT_PERMIT2 = address(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    address USER = vm.envAddress("USER");
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    LPRebalanceHook hook;
    PoolKey key;
    address poolManagerAddr;
    Currency c0;
    Currency c1;
    address posmAddr;

    function run() public {
        // Env
        if (USER == address(0)) {
            revert("Set USER env var");
        }

        poolManagerAddr = vm.envOr({name: "POOL_MANAGER", defaultValue: address(0)});
        require(poolManagerAddr != address(0), "Set POOL_MANAGER env var");

        posmAddr = vm.envOr({name: "POSITION_MANAGER", defaultValue: address(0)});
        require(posmAddr != address(0), "Set POSITION_MANAGER env var");

        // Mine and deploy the hook
        uint160 flags = uint160(Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_INITIALIZE_FLAG);
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManagerAddr), USER);
        (address expectedHookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(LPRebalanceHook).creationCode, constructorArgs);

        vm.startBroadcast();

        hook = new LPRebalanceHook{salt: salt}(IPoolManager(poolManagerAddr), USER);
        require(address(hook) == expectedHookAddress, "Hook address mismatch");

        (MockERC20 tokenA, MockERC20 tokenB) = deployAndApproveTokens();

        initCurrencies(tokenA, tokenB);

        deployPool();

        // Add liquidity using PositionManager multicall-style actions
        addPoolLiquidity();

        // moveTickLowerByTokenAmount(0.02 ether);

        vm.stopBroadcast();

        // Log outputs
        int24 lastTick = hook.lastTicks(key.toId());
        console2.log("Last tick after hook deployment:", lastTick);

        PoolId poolId = key.toId();
        console2.log("Hook:", address(hook));
        console2.log("TokenA:", address(tokenA));
        console2.log("TokenB:", address(tokenB));
        console2.log("Currency0:", Currency.unwrap(key.currency0));
        console2.log("Currency1:", Currency.unwrap(key.currency1));
        console2.log("Pool Id:");
        console2.logBytes32(PoolId.unwrap(poolId));
        writeDeploymentFile();
    }

    function moveTickLowerByTokenAmount(uint128 amountIn) internal {
        // moving tick lower by selling some token0
        MockV4Router mockRouter = new MockV4Router(IPoolManager(poolManagerAddr));
        MockERC20(Currency.unwrap(key.currency0)).approve(address(mockRouter), amountIn);
        MockERC20(Currency.unwrap(key.currency1)).approve(address(mockRouter), amountIn);

        bytes memory actions =
            abi.encodePacked(uint8(Actions.SWAP_EXACT_IN_SINGLE), uint8(Actions.SETTLE_ALL), uint8(Actions.TAKE_ALL));

        uint128 amountOutMinimum = 0;
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: key,
                zeroForOne: true,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                hookData: bytes("")
            })
        );
        params[1] = abi.encode(key.currency0, amountIn);
        params[2] = abi.encode(key.currency1, amountOutMinimum);

        mockRouter.executeActions(abi.encode(actions, params));
    }

    function writeDeploymentFile() internal {
        // Ensure directory exists and write JSON with requested fields under packages/foundry/deployments
        string memory root = vm.projectRoot();
        string memory dir = string.concat(root, "/deployments");
        vm.createDir(dir, true);

        string memory chainIdStr = vm.toString(block.chainid);
        string memory path = string.concat(dir, "/", chainIdStr, ".json");

        PoolId poolId = key.toId();

        string memory obj = "deployment";
        vm.serializeAddress(obj, "hook", address(hook));
        vm.serializeAddress(obj, "currency0", Currency.unwrap(key.currency0));
        vm.serializeAddress(obj, "currency1", Currency.unwrap(key.currency1));
        string memory json = vm.serializeBytes32(obj, "poolId", PoolId.unwrap(poolId));

        vm.writeJson(json, path);
        console2.log("Deployment written to:", path);
    }

    function deployPool() internal {
        console.log("Deploying pool");
        uint24 fee = uint24(vm.envOr({name: "POOL_FEE", defaultValue: uint256(3000)}));
        int24 tickSpacing = int24(uint24(vm.envOr({name: "TICK_SPACING", defaultValue: uint256(30)})));

        // Build PoolKey with deployed hook
        key = PoolKey({currency0: c0, currency1: c1, fee: fee, tickSpacing: tickSpacing, hooks: hook});

        // Initialize pool
        IPoolManager(poolManagerAddr).initialize(key, SQRT_PRICE_1_1);
        console.log("Pool initialized");
    }

    function deployAndApproveTokens() internal returns (MockERC20 tokenA, MockERC20 tokenB) {
        console.log("Deploying and approving tokens");
        address permit2 = vm.envOr({name: "PERMIT2", defaultValue: DEFAULT_PERMIT2});

        MockERC20 tokenA = new MockERC20("TokenA", "TKNA", 6);
        MockERC20 tokenB = new MockERC20("TokenB", "TKNB", 6);

        // Mint ample balances to broadcaster
        tokenA.mint(msg.sender, 1_000_000 ether);
        tokenB.mint(msg.sender, 1_000_000 ether);
        tokenA.mint(USER, 100 ether);
        tokenB.mint(USER, 100 ether);

        // Approve Permit2 and sub-approve PositionManager via Permit2
        tokenA.approve(permit2, type(uint256).max);
        tokenB.approve(permit2, type(uint256).max);
        IAllowanceTransfer(permit2).approve(address(tokenA), posmAddr, type(uint160).max, type(uint48).max);
        IAllowanceTransfer(permit2).approve(address(tokenB), posmAddr, type(uint160).max, type(uint48).max);

        console.log("Tokens deployed and approved");
        return (tokenA, tokenB);
    }

    function initCurrencies(MockERC20 tokenA, MockERC20 tokenB) internal {
        console.log("Initializing currencies");
        c0 = Currency.wrap(address(tokenA));
        c1 = Currency.wrap(address(tokenB));
        if (Currency.unwrap(c0) > Currency.unwrap(c1)) {
            (c0, c1) = (c1, c0);
        }
        console.log("Currencies initialized");
    }

    function addPoolLiquidity() internal {
        console.log("Adding pool liquidity");
        IPositionManager posM = IPositionManager(posmAddr);
        bytes memory actions =
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.CLOSE_CURRENCY), uint8(Actions.CLOSE_CURRENCY));

        // First range
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            key,
            int24(-60),
            int24(60),
            uint256(10 ether),
            uint128(type(uint128).max),
            uint128(type(uint128).max),
            msg.sender,
            bytes("")
        );
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        posM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 120 seconds);

        params[0] = abi.encode(
            key,
            int24(-120),
            int24(120),
            uint256(10 ether),
            uint128(type(uint128).max),
            uint128(type(uint128).max),
            msg.sender,
            bytes("")
        );
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        posM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 30 minutes);
        console.log("Pool liquidity added");
    }
}
