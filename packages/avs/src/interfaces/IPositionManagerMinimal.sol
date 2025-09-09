// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IPositionManagerMinimal {
    function ownerOf(uint256 tokenId) external view returns (address);
}
