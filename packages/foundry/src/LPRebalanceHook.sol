// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {UserConfig} from "./libraries/Config.sol";
import {IRangeExitServiceManager} from "./interfaces/IRangeExitServiceManager.sol";
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

    error OwnerDoesNotOwnThePosition();
    error PositionAlreadyWithdrawn();

    event ServiceNotSet();

    mapping(uint256 positionId => bool) public isWithdrawn;

    mapping(PoolId poolId => int24 lastTick) public lastTicks;

    IRangeExitServiceManager public service;

    uint128 TASK_DEADLINE = 600;

    modifier onlyService() {
        require(msg.sender == address(service), "Not allowed");
        _;
    }

    constructor(IPoolManager _manager, address owner) BaseHook(_manager) Ownable(owner) {}

    function setService(address _service) external onlyOwner {
        service = IRangeExitServiceManager(_service);
    }

    function setTaskDeadline(uint128 _taskDeadline) external onlyOwner {
        TASK_DEADLINE = _taskDeadline;
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
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) internal pure override returns (bytes4, BalanceDelta) {
        return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        int24 lastTick = lastTicks[key.toId()];
        lastTicks[key.toId()] = currentTick;

        if (address(service) == address(0)) {
            emit ServiceNotSet();
        }

        if (address(service) != address(0)) {
            uint256 deadline = block.timestamp + TASK_DEADLINE;
            IRangeExitServiceManager.PoolKeyCustom memory poolKeyCustom = IRangeExitServiceManager.PoolKeyCustom({
                currency0: Currency.unwrap(key.currency0),
                currency1: Currency.unwrap(key.currency1),
                fee: key.fee,
                tickSpacing: key.tickSpacing,
                hookAddress: address(this)
            });
            PoolId poolId = key.toId();
            service.createNewTask(poolKeyCustom, lastTick, deadline, poolId);
        }

        return (this.afterSwap.selector, 0);
    }

    function getLowerUsableTick(int24 tick, int24 tickSpacing) public pure returns (int24) {
        int24 intervals = tick / tickSpacing;

        if (tick < 0 && tick % tickSpacing != 0) {
            intervals--;
        }

        return intervals * tickSpacing;
    }

    function getCurrentTick(PoolKey calldata key) external view returns (int24) {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        return currentTick;
    }

    function getCurrentTick(PoolId poolId) external view returns (int24) {
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);
        return currentTick;
    }
}
