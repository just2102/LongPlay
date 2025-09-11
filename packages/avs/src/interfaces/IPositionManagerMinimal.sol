// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IPositionManagerMinimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    // optional methods used by strategies
    // function burn(uint256 tokenId) external;
    // function decreaseLiquidity(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) external returns (uint256, uint256);
}
