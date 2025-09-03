// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {LPRebalanceHook} from "../src/LPRebalanceHook.sol";
import {UserConfig} from "../src/libraries/Config.sol";
import {LPSubscriber} from "../src/LPSubscriber.sol";
import {SignatureLibrary} from "../src/libraries/Signature.sol";
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
    ISubscriber public lpSubscriber;

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
        hook.setService(SERVICE);

        deployTokens();
        deployLPSubscriberAndSubscribe();
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

    function test_AddAndWithdrawLiquidity() external {
        int24 currentTick = getCurrentTick();
        int24 lowerUsableTick = getLowerUsableTick(currentTick, poolKey.tickSpacing);
        assertEq(lowerUsableTick, 0);

        // send some of both tokens to the user address
        MockERC20(Currency.unwrap(token0)).transfer(USER, 5 ether);
        MockERC20(Currency.unwrap(token1)).transfer(USER, 5 ether);

        // todo: user could be adding liquidity to an existing position
        // we either don't handle it at all,
        // or we handle it by using the existing positionId and passing it to the hookData
        uint256 positionId = posM.nextTokenId();

        addAndWithdrawLiquidity(positionId);
    }

    function addAndWithdrawLiquidity(uint256 positionId) internal {
        vm.startPrank(USER);

        // Mint a position via deployed POSM
        // autosettle with CLOSE_CURRENCY for simplicity
        bytes memory actions =
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.CLOSE_CURRENCY), uint8(Actions.CLOSE_CURRENCY));
        bytes[] memory params = new bytes[](3);

        // sign offchain, pass into userConfig
        bytes memory signature = _getSignature();

        int24 tickLower = -60;
        int24 tickUpper = -30;
        UserConfig memory config = UserConfig({
            tickThreshold: -60,
            owner: USER,
            positionId: positionId,
            posM: address(posM),
            signature: signature
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

        // the hook should now be able to close our LP position.
        // the funds should go back to the owner of the NFT.
        hook.withdrawLiquidity(poolKey, address(posM), tickBeforeSwap);

        // nft should be burned
        vm.expectRevert("NOT_MINTED");
        ERC721Permit_v4(address(posM)).ownerOf(positionId);

        uint256 balanceOfToken0AfterDoStuff = MockERC20(Currency.unwrap(token0)).balanceOf(USER);
        assertGt(balanceOfToken0AfterDoStuff, balanceOfToken0BeforeDoStuff);

        vm.stopPrank();
    }

    function _getSignature() internal pure returns (bytes memory) {
        bytes memory sig =
            hex"09252ebc97618d8a36495fe93bb83df193a9ee0d97890fe0af1833739128d3e41f18ee97de7b12f3641326afda58f12490ed3d30cb91f268d842fc8f587f4ce61b";
        return sig;
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

    function deployLPSubscriberAndSubscribe() internal {
        lpSubscriber = new LPSubscriber(posM);
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

    // todo: refactor into library
    function getLowerUsableTick(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        if (tick >= 0) {
            // round down for positive numbers
            return (tick / tickSpacing) * tickSpacing;
        } else {
            // round up for negative numbers
            int24 remainder = tick % tickSpacing;
            if (remainder == 0) {
                return tick;
            } else {
                // subtract remainder to round up
                return tick - remainder;
            }
        }
    }
}
