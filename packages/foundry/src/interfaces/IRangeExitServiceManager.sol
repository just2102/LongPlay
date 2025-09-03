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

    event WithdrawNeeded(PoolKeyCustom indexed poolKey, int24 indexed lastTick, uint256 deadline);
    event TaskResponded(bytes32 indexed taskHash, Task task, address operator);

    function createNewTask(PoolKeyCustom calldata poolKey, int24 lastTick, uint256 deadline)
        external
        returns (bytes32);
}
