// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

struct UserConfig {
    int24 tickThreshold;
    address owner;
    uint256 positionId;
    address posM;
    bytes signature;
}

uint8 constant MAX_REBALANCES_NUM = 1;
