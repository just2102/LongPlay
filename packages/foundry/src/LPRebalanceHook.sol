// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {UserConfig} from "./libraries/Config.sol";
import {IRangeExitServiceManager} from "./interfaces/IRangeExitServiceManager.sol";
import {SignatureLibrary} from "./libraries/Signature.sol";

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {ERC721Permit_v4} from "v4-periphery/src/base/ERC721Permit_v4.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";

import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Test, console} from "forge-std/Test.sol";

contract LPRebalanceHook is BaseHook, ReentrancyGuard, Ownable {
    using StateLibrary for IPoolManager;

    error InvalidSignature();
    error OwnerDoesNotOwnThePosition();
    error PositionAlreadyWithdrawn();

    mapping(int24 tickThreshold => uint256[] positionIds) public positions;
    mapping(uint256 positionId => bool) public isWithdrawn;
    mapping(PoolId poolId => mapping(uint256 positionId => bool)) public exitRequested;
    mapping(uint256 positionId => UserConfig config) public userConfigs;

    mapping(PoolId poolId => int24 lastTick) public lastTicks;

    IRangeExitServiceManager public service;

    modifier onlyService() {
        require(msg.sender == address(service), "Not allowed");
        _;
    }

    constructor(IPoolManager _manager, address owner) BaseHook(_manager) Ownable(owner) {}

    function setService(address _service) external onlyOwner {
        service = IRangeExitServiceManager(_service);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _afterInitialize(address, PoolKey calldata key, uint160, int24 tick) internal override returns (bytes4) {
        lastTicks[key.toId()] = tick;
        return this.afterInitialize.selector;
    }

    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta feesAccrued,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());

        if (params.tickLower > currentTick) {
            return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        UserConfig memory userConfig;
        // todo: add check for hookData.length (it should be fixed size)
        if (hookData.length > 0) {
            (userConfig) = abi.decode(hookData, (UserConfig));

            // validate position owner:
            address owner = ERC721Permit_v4(userConfig.posM).ownerOf(userConfig.positionId);
            if (owner != userConfig.owner) {
                revert OwnerDoesNotOwnThePosition();
            }
            // todo: use secure message and nonce values
            bool isVerified = SignatureLibrary.verify(owner, owner, 0 ether, "testDemo", 1, userConfig.signature);
            if (!isVerified) {
                revert InvalidSignature();
            }
        }

        userConfigs[userConfig.positionId] = userConfig;
        positions[userConfig.tickThreshold].push(userConfig.positionId);

        return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        int24 lastTick = lastTicks[key.toId()];
        int24 currentTickToUse = getLowerUsableTick(currentTick, key.tickSpacing);

        if (currentTickToUse > lastTick) {
            lastTicks[key.toId()] = currentTick;
            return (this.afterSwap.selector, 0);
        }

        if (currentTickToUse < lastTick) {
            console.log("Service address: ", address(service));
            if (address(service) != address(0)) {
                uint256 deadline = block.timestamp + 60;
                IRangeExitServiceManager.PoolKeyCustom memory poolKeyCustom = IRangeExitServiceManager.PoolKeyCustom({
                    currency0: Currency.unwrap(key.currency0),
                    currency1: Currency.unwrap(key.currency1),
                    fee: key.fee,
                    tickSpacing: key.tickSpacing,
                    hookAddress: address(this)
                });
                bytes32 taskHash = service.createNewTask(poolKeyCustom, lastTick, deadline);
                console.log("Task successfully sent to service. TaskHash:");
                console.logBytes32(taskHash);
                // operator flow:
                // 1. listen to WithdrawNeeded event.
                // 2. get lastTick from the event.
                // 3. call hook.withdrawLiquidity(key, posManagerAddress, lastTick)
                // 4. check the liquidity was withdrawn successfully
                // 5. signal success
                // 6. deposit the withdrawn asset to Aave.
            }
        }

        return (this.afterSwap.selector, 0);
    }

    function withdrawLiquidity(PoolKey calldata key, address posManagerAddress, int24 lastTick) external nonReentrant {
        IPositionManager posM = IPositionManager(posManagerAddress);
        bytes memory actions = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR));

        bytes[] memory params = new bytes[](2);

        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        int24 currentTickToUse = getLowerUsableTick(currentTick, key.tickSpacing);
        console.log("Current tick: ", currentTick);
        console.log("Current tick to use: ", currentTickToUse);
        console.log("Last tick: ", lastTick);
        while (currentTickToUse < lastTick) {
            uint256[] memory positionIds = positions[currentTickToUse];
            Currency currency0 = key.currency0;
            Currency currency1 = key.currency1;
            for (uint256 i = 0; i < positionIds.length; i++) {
                uint256 positionId = positionIds[i];
                if (positionId != 0) {
                    if (isWithdrawn[positionId]) {
                        revert PositionAlreadyWithdrawn();
                    }

                    UserConfig memory userConfig = userConfigs[positionId];

                    // todo: add min amounts
                    uint128 amount0Min = 0;
                    uint128 amount1Min = 0;
                    bytes memory hookData = bytes("");
                    uint256 deadline = block.timestamp + 60;

                    params[0] = abi.encode(positionId, amount0Min, amount1Min, hookData);
                    params[1] = abi.encode(currency0, currency1, userConfig.owner);

                    console.log("Burning position id: ", positionId);
                    console.log("Recipient: ", userConfig.owner);

                    isWithdrawn[positionId] = true;
                    posM.modifyLiquidities(abi.encode(actions, params), deadline);
                    console.log("Modified liquidities successfully");
                }
            }
            currentTickToUse += key.tickSpacing;
        }
    }

    function approveLpTokens(address positionManager, uint256 tokenId) external {
        ERC721Permit_v4(positionManager).approve(address(this), tokenId);
    }

    function getLowerUsableTick(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        // todo (extra): optimize gas costs caused by withdrawing too often
        // example:
        // tickSpacing = 30
        // this function would return -180, -90, 0, 90, 180

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

    // function exitFulfilled(PoolId poolId, bytes32 positionId) external onlyService {
    //     exitRequested[poolId][positionId] = false;
    // }
}
