// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.2;

interface IRangeExitServiceManager {
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

    event WithdrawNeeded(PoolKeyCustom indexed poolKey, int24 indexed lastTick, uint256 deadline);
    event TaskResponded(bytes32 indexed taskHash, Task task, address operator);

    // @notice Emitted when a new position is configured
    event PositionConfigured(int24 indexed tickThreshold, uint256 indexed positionId, UserConfig config);
    // Emitted when the operator requests the AVS to modify a batch of positions for a task
    event PositionsModificationRequested(bytes32 indexed taskHash, uint256 indexed batchId, uint256 positionsCount);
    // Emitted for each successfully modified position (withdrawn from Uniswap and routed)
    event PositionModified(uint256 indexed positionId, address indexed owner);
    // Emitted when a user cancels delegation/approval and the AVS processes refunding leftovers
    event DelegationCancelled(address indexed owner, uint256 indexed positionId, uint256 refundedNative);
}
