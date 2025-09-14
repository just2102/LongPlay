// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {IRangeExitServiceManager} from "./IRangeExitServiceManager.sol";

interface ILPRebalanceHook {
    function getCurrentTick(IRangeExitServiceManager.PoolKeyCustom calldata key) external view returns (int24);
    function setService(address _service) external;
    function getLowerUsableTick(int24 tick, int24 tickSpacing) external pure returns (int24);
}
