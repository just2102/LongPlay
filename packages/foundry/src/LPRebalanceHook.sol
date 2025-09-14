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

    mapping(int24 tickThreshold => uint256[] positionIds) public positions;
    mapping(uint256 positionId => bool) public isWithdrawn;
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

    // todo: replace this function with an AVS contract call
    // that will take the required params (e.g., config, positionId)
    // and remember the position for future management
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
        if (hookData.length > 0) {
            (userConfig) = abi.decode(hookData, (UserConfig));

            // validate position owner:
            address owner = ERC721Permit_v4(userConfig.posM).ownerOf(userConfig.positionId);
            if (owner != userConfig.owner) {
                revert OwnerDoesNotOwnThePosition();
            }
        }

        userConfigs[userConfig.positionId] = userConfig;
        positions[userConfig.tickThreshold].push(userConfig.positionId);

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

        if (currentTick > lastTick) {
            return (this.afterSwap.selector, 0);
        }

        if (currentTick < lastTick) {
            console.log("Service address: ", address(service));
            if (address(service) != address(0)) {
                // todo: change deadline to a smaller value in production (e.g., 60)
                uint256 deadline = block.timestamp + 600;
                IRangeExitServiceManager.PoolKeyCustom memory poolKeyCustom = IRangeExitServiceManager.PoolKeyCustom({
                    currency0: Currency.unwrap(key.currency0),
                    currency1: Currency.unwrap(key.currency1),
                    fee: key.fee,
                    tickSpacing: key.tickSpacing,
                    hookAddress: address(this)
                });
                PoolId poolId = key.toId();
                bytes32 taskHash = service.createNewTask(poolKeyCustom, lastTick, deadline, poolId);
                console.log("Task successfully sent to service. TaskHash:");
                console.logBytes32(taskHash);
            }
        }

        return (this.afterSwap.selector, 0);
    }

    // todo: approve to AVS contract
    function approveLpTokens(address positionManager, uint256 tokenId) external {
        ERC721Permit_v4(positionManager).approve(address(this), tokenId);
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
