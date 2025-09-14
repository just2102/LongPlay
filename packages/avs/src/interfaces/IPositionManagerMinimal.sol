// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {IRangeExitServiceManager} from "./IRangeExitServiceManager.sol";

interface IPositionManagerMinimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external;
    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (IRangeExitServiceManager.PoolKeyCustom memory, uint256);
}
