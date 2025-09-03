// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";

import {ISubscriber} from "v4-periphery/src/interfaces/ISubscriber.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {PositionInfo} from "v4-periphery/src/libraries/PositionInfoLibrary.sol";

contract LPSubscriber is ISubscriber {
    IPositionManager posm;
    uint256 public notifySubscribeCount;
    uint256 public notifyUnsubscribeCount;
    uint256 public notifyModifyLiquidityCount;
    uint256 public notifyBurnCount;

    error NotAuthorizedNotifer(address sender);

    constructor(IPositionManager _posm) {
        posm = _posm;
    }

    modifier onlyByPosm() {
        if (msg.sender != address(posm)) revert NotAuthorizedNotifer(msg.sender);
        _;
    }

    function notifySubscribe(uint256, bytes memory) external onlyByPosm {
        console.log("Notify subscribe, notifySubscribeCount: ", notifySubscribeCount);
        console.log("New notify subscribe", notifySubscribeCount + 1);
        notifySubscribeCount++;
    }

    function notifyUnsubscribe(uint256) external onlyByPosm {
        notifyUnsubscribeCount++;
    }

    function notifyModifyLiquidity(uint256, int256, BalanceDelta) external onlyByPosm {
        console.log("Notify modify liquidity, notifyModifyLiquidityCount: ", notifyModifyLiquidityCount);
        console.log("New notify modify liquidity", notifyModifyLiquidityCount + 1);
        notifyModifyLiquidityCount++;
    }

    function notifyBurn(uint256, address, PositionInfo, uint256, BalanceDelta) external onlyByPosm {
        console.log("Notify burn, notifyBurnCount: ", notifyBurnCount);
        console.log("New notify burn", notifyBurnCount + 1);
        notifyBurnCount++;
    }
}
