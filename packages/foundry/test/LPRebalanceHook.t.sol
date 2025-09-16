// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {LPRebalanceHook} from "../src/LPRebalanceHook.sol";
import {UserConfig} from "../src/libraries/Config.sol";
import {IRangeExitServiceManager} from "../src/interfaces/IRangeExitServiceManager.sol";

import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {Position} from "v4-core/libraries/Position.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IPositionDescriptor} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IV4Router} from "v4-periphery/src/interfaces/IV4Router.sol";
import {PositionInfo, PositionInfoLibrary} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {ERC721Permit_v4} from "v4-periphery/src/base/ERC721Permit_v4.sol";
import {ISubscriber} from "v4-periphery/src/interfaces/ISubscriber.sol";

import {MockV4Router} from "v4-periphery/test/mocks/MockV4Router.sol";

contract LPRebalanceHookTest is Test, Deployers {
    LPRebalanceHook public hook;
    MockV4Router public mockRouter;

    using StateLibrary for IPoolManager;

    Currency token0;
    Currency token1;
    PoolKey poolKey;

    int24 constant TICK_SPACING = 30;

    // https://docs.uniswap.org/contracts/v4/deployments
    address POSM = vm.envAddress("POSITION_MANAGER");
    address PERMIT2 = vm.envAddress("PERMIT2");

    address USER = vm.envAddress("USER");
    uint256 USER_PK = vm.envUint("USER_PK");

    address SERVICE = vm.envAddress("SERVICE"); // AVS Service, has to be deployed first

    IPositionManager posM;

    function setUp() public {
        deployFreshManagerAndRouters();
        posM = IPositionManager(POSM);
        manager = posM.poolManager();
        require(address(manager) != address(0), "Position manager is not deployed");
        mockRouter = new MockV4Router(manager);

        deployHook();
        // hook.setService(SERVICE);

        deployTokens();
        // Approve Permit2 and then sub-approve POSM as spender via Permit2
        MockERC20(Currency.unwrap(token0)).approve(PERMIT2, type(uint256).max);
        MockERC20(Currency.unwrap(token1)).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(Currency.unwrap(token0), address(posM), type(uint160).max, type(uint48).max);
        IAllowanceTransfer(PERMIT2).approve(Currency.unwrap(token1), address(posM), type(uint160).max, type(uint48).max);
        vm.startPrank(USER);
        MockERC20(Currency.unwrap(token0)).approve(PERMIT2, type(uint256).max);
        MockERC20(Currency.unwrap(token1)).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(Currency.unwrap(token0), address(posM), type(uint160).max, type(uint48).max);
        IAllowanceTransfer(PERMIT2).approve(Currency.unwrap(token1), address(posM), type(uint160).max, type(uint48).max);
        vm.stopPrank();

        deployPool();
        addPoolLiquidity();
        sellSomeToken0(0.02 ether);
        int24 tickAfterSwap = getCurrentTick();
        assertEq(tickAfterSwap, -20);
    }

    function test_getCurrentTick() external view {
        int24 tick = hook.getCurrentTick(poolKey);
        int24 tick2 = hook.getCurrentTick(poolKey.toId());
        assertEq(tick, tick2);
    }

    function test_createNewTask_OnlyHookCanCreateTask() external {
        vm.expectRevert("Only hook contract can call this function");
        IRangeExitServiceManager.PoolKeyCustom memory poolKeyCustom = IRangeExitServiceManager.PoolKeyCustom({
            currency0: Currency.unwrap(poolKey.currency0),
            currency1: Currency.unwrap(poolKey.currency1),
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hookAddress: address(hook)
        });
        IRangeExitServiceManager(SERVICE).createNewTask(poolKeyCustom, -20, block.timestamp + 600, poolKey.toId());
    }

    function test_createNewTask_CanCreateTask() external {
        address deployedHook = vm.envAddress("HOOK");

        IRangeExitServiceManager.PoolKeyCustom memory poolKeyCustom = IRangeExitServiceManager.PoolKeyCustom({
            currency0: Currency.unwrap(poolKey.currency0),
            currency1: Currency.unwrap(poolKey.currency1),
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hookAddress: deployedHook
        });
        address hookOnService = IRangeExitServiceManager(SERVICE).HOOK();
        assertEq(hookOnService, deployedHook, "Hook on service is not the same as the hook");
        vm.prank(deployedHook);
        IRangeExitServiceManager(SERVICE).createNewTask(poolKeyCustom, -20, block.timestamp + 600, poolKey.toId());
    }

    function test_MintAndConfigurePosition() external {
        require(address(SERVICE) != address(0), "SERVICE is not set");

        uint256 positionId = posM.nextTokenId();
        addLiquidity(positionId, -120, 120);

        vm.prank(USER);
        ERC721Permit_v4(address(posM)).setApprovalForAll(address(SERVICE), true);

        vm.prank(USER);
        IRangeExitServiceManager(SERVICE).configurePosition(
            -120, IRangeExitServiceManager.StrategyId.Asset0ToAave, positionId, address(posM), poolKey.tickSpacing
        );
    }

    function test_AddLiquidity() external {
        int24 currentTick = getCurrentTick();
        int24 lowerUsableTick = hook.getUsableTick(currentTick, poolKey.tickSpacing);
        assertEq(lowerUsableTick, -30);

        uint256 positionId = posM.nextTokenId();

        addLiquidity(positionId, -60, -30);
    }

    function test_getUsableTick_negative() external view {
        int24 tickThresholdToUse = hook.getUsableTick(-24, 30);
        assertEq(tickThresholdToUse, -30);

        tickThresholdToUse = hook.getUsableTick(-20, 30);
        assertEq(tickThresholdToUse, -30);

        tickThresholdToUse = hook.getUsableTick(-18, 30);
        assertEq(tickThresholdToUse, -30);

        tickThresholdToUse = hook.getUsableTick(-12, 30);
        assertEq(tickThresholdToUse, -30);

        tickThresholdToUse = hook.getUsableTick(-6, 30);
        assertEq(tickThresholdToUse, -30);
    }

    function test_getUsableTick_positive() external view {
        int24 tickThresholdToUse = hook.getUsableTick(24, 30);
        assertEq(tickThresholdToUse, 30);

        tickThresholdToUse = hook.getUsableTick(20, 30);
        assertEq(tickThresholdToUse, 30);

        tickThresholdToUse = hook.getUsableTick(30, 30);
        assertEq(tickThresholdToUse, 30);

        tickThresholdToUse = hook.getUsableTick(31, 30);
        assertEq(tickThresholdToUse, 60);
    }

    function addLiquidity(uint256 positionId, int24 tickLower, int24 tickUpper) internal {
        vm.startPrank(USER);

        // Mint a position via deployed POSM
        // autosettle with CLOSE_CURRENCY for simplicity
        bytes memory actions =
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.CLOSE_CURRENCY), uint8(Actions.CLOSE_CURRENCY));
        bytes[] memory params = new bytes[](3);

        UserConfig memory config = UserConfig({
            tickThreshold: -60,
            owner: USER,
            positionId: positionId,
            posM: address(posM),
            strategyId: uint8(IRangeExitServiceManager.StrategyId.Asset0ToAave)
        });

        bytes memory hookData = abi.encode(config);
        params[0] = abi.encode(
            key,
            tickLower,
            tickUpper,
            uint256(1 ether),
            uint128(type(uint128).max),
            uint128(type(uint128).max),
            USER,
            hookData
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        posM.modifyLiquidities(abi.encode(actions, params), block.timestamp * 2);

        // ensure the positionId is correct
        (, PositionInfo info) = posM.getPoolAndPositionInfo(positionId);
        assertEq(PositionInfoLibrary.tickLower(info), tickLower, "Tick lower mismatch");
        assertEq(PositionInfoLibrary.tickUpper(info), tickUpper, "Tick upper mismatch");

        // allow the hook to use our NFTs
        ERC721Permit_v4(address(posM)).setApprovalForAll(address(hook), true);

        int24 tickBeforeSwap = getCurrentTick();

        sellSomeToken0(0.05 ether);

        uint256 balanceOfToken0BeforeDoStuff = MockERC20(Currency.unwrap(token0)).balanceOf(USER);

        // we should now be able to withdraw the liquidity via the AVS contract
        // the funds should go back to the owner of the NFT.
        // hook.withdrawLiquidity(poolKey, address(posM), tickBeforeSwap);

        // // nft should be burned
        // vm.expectRevert("NOT_MINTED");
        // ERC721Permit_v4(address(posM)).ownerOf(positionId);

        // uint256 balanceOfToken0AfterDoStuff = MockERC20(Currency.unwrap(token0)).balanceOf(USER);
        // assertGt(balanceOfToken0AfterDoStuff, balanceOfToken0BeforeDoStuff);

        vm.stopPrank();
    }

    function getCurrentTick() internal view returns (int24) {
        (, int24 currentTick,,) = manager.getSlot0(key.toId());
        return currentTick;
    }

    function deployTokens() internal {
        (token0, token1) = deployMintAndApprove2Currencies();

        MockERC20(Currency.unwrap(token0)).approve(address(hook), type(uint256).max);
        MockERC20(Currency.unwrap(token1)).approve(address(hook), type(uint256).max);

        // approve mock v4 router to pull funds for settlement
        MockERC20(Currency.unwrap(token0)).approve(address(mockRouter), type(uint256).max);
        MockERC20(Currency.unwrap(token1)).approve(address(mockRouter), type(uint256).max);

        vm.startPrank(USER);
        MockERC20(Currency.unwrap(token0)).approve(address(hook), type(uint256).max);
        MockERC20(Currency.unwrap(token1)).approve(address(hook), type(uint256).max);
        MockERC20(Currency.unwrap(token0)).approve(address(mockRouter), type(uint256).max);
        MockERC20(Currency.unwrap(token1)).approve(address(mockRouter), type(uint256).max);
        vm.stopPrank();

        // send some of both tokens to the user address
        MockERC20(Currency.unwrap(token0)).transfer(USER, 5 ether);
        MockERC20(Currency.unwrap(token1)).transfer(USER, 5 ether);
    }

    function deployHook() internal {
        uint160 flags = uint160(Hooks.AFTER_ADD_LIQUIDITY_FLAG) | uint160(Hooks.AFTER_SWAP_FLAG)
            | uint160(Hooks.AFTER_INITIALIZE_FLAG);

        address owner = vm.envAddress("USER");
        if (owner == address(0)) {
            revert("Set USER env var");
        }

        deployCodeTo("LPRebalanceHook.sol", abi.encode(manager, owner), address(flags));

        hook = LPRebalanceHook(address(flags));
    }

    function deployPool() internal {
        (key,) = initPool(token0, token1, hook, 3000, TICK_SPACING, SQRT_PRICE_1_1);
        poolKey = key;
    }

    function addPoolLiquidity() internal {
        // autosettle with CLOSE_CURRENCY for simplicity
        bytes memory actions =
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.CLOSE_CURRENCY), uint8(Actions.CLOSE_CURRENCY));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            int24(-60),
            int24(60),
            uint256(10 ether),
            uint128(type(uint128).max),
            uint128(type(uint128).max),
            address(this),
            ZERO_BYTES
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);
        posM.modifyLiquidities(abi.encode(actions, params), block.timestamp * 2);

        params[0] = abi.encode(
            poolKey,
            int24(-120),
            int24(120),
            uint256(10 ether),
            uint128(type(uint128).max),
            uint128(type(uint128).max),
            address(this),
            ZERO_BYTES
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);
        posM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function sellSomeToken0(uint128 amountIn) internal {
        int24 tickBefore = getCurrentTick();
        console.log("Tick before sellSomeToken0: ", tickBefore);
        bytes memory actions =
            abi.encodePacked(uint8(Actions.SWAP_EXACT_IN_SINGLE), uint8(Actions.SETTLE_ALL), uint8(Actions.TAKE_ALL));

        uint128 amountOutMinimum = 0;
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: true,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                hookData: ZERO_BYTES
            })
        );
        params[1] = abi.encode(poolKey.currency0, amountIn);
        params[2] = abi.encode(poolKey.currency1, amountOutMinimum);

        mockRouter.executeActions(abi.encode(actions, params));
    }
}
