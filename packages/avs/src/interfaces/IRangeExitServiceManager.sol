// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.2;

interface IRangeExitServiceManager {
    error UserNotPositionOwner(address positionOwner, address caller);

    struct PoolKeyCustom {
        /// @notice The lower currency of the pool, sorted numerically
        address currency0;
        /// @notice The higher currency of the pool, sorted numerically
        address currency1;
        /// @notice The pool LP fee, capped at 1_000_000. If the highest bit is 1, the pool has a dynamic fee and must be exactly equal to 0x800000
        uint24 fee;
        /// @notice Ticks that involve positions must be a multiple of tick spacing
        int24 tickSpacing;
        address hookAddress;
    }

    struct Task {
        PoolKeyCustom poolKey;
        int24 lastTick;
        uint256 deadline;
        uint32 createdBlock;
    }

    enum StrategyId {
        None,
        Asset0ToAave
    }

    struct UserConfig {
        int24 tickThreshold;
        uint8 strategyId;
        address owner;
        uint256 positionId;
        address posM;
    }

    event WithdrawNeeded(
        Task task,
        uint256 indexed taskIndex,
        PoolKeyCustom poolKey,
        int24 indexed lastTick,
        uint256 deadline,
        bytes32 poolId
    );
    event TaskResponded(bytes32 indexed taskHash, Task task, address operator);

    // @notice Emitted when a new position is configured
    event PositionConfigured(int24 indexed tickThreshold, uint256 indexed positionId, UserConfig config);
    // Emitted when the operator requests the AVS to modify a batch of positions for a task
    event PositionsModificationRequested(bytes32 indexed taskHash, uint256 positionsCount);
    // Emitted for each successfully burned position
    event PositionBurned(uint256 indexed positionId, address indexed owner, UserConfig config);
    // Emitted when a user cancels delegation/approval and the AVS processes refunding leftovers
    event DelegationCancelled(address indexed owner, uint256 indexed positionId, uint256 refundedNative);

    function setHookAddress(address _hookAddress) external;
}
