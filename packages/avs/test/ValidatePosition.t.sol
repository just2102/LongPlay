// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {console} from "forge-std/console.sol";
import {Test} from "forge-std/Test.sol";
import {RangeExitManagerService} from "../src/RangeExitManagerService.sol";
import {IPositionManagerMinimal} from "../src/interfaces/IPositionManagerMinimal.sol";
import {IRangeExitServiceManager} from "../src/interfaces/IRangeExitServiceManager.sol";
import {ILPRebalanceHook} from "../src/interfaces/ILPRebalanceHook.sol";

contract ValidatePosition is Test {
    RangeExitManagerService public rangeExitManagerService;
    IPositionManagerMinimal public positionManager;

    function setUp() public {
        address serviceAddress = vm.envAddress("SERVICE_ADDRESS");
        rangeExitManagerService = RangeExitManagerService(serviceAddress);
        positionManager = IPositionManagerMinimal(vm.envAddress("POSITION_MANAGER_ADDRESS"));
    }

    function test_validPositionForWithdraw() public view {
        address owner = vm.envAddress("OPERATOR_ADDRESS");

        IRangeExitServiceManager.UserConfig memory userConfig = IRangeExitServiceManager.UserConfig({
            positionId: 60000,
            posM: address(positionManager),
            tickThreshold: 30,
            strategyId: uint8(IRangeExitServiceManager.StrategyId.Asset0ToAave),
            owner: owner
        });
        bool isValidPosition = rangeExitManagerService.validatePositionForWithdraw(userConfig, positionManager);
        assert(isValidPosition);
    }

    function test_invalidPositionForWithdraw() public view {
        address owner = vm.envAddress("OPERATOR_ADDRESS");

        IRangeExitServiceManager.UserConfig memory userConfig = IRangeExitServiceManager.UserConfig({
            positionId: 99999,
            posM: address(positionManager),
            tickThreshold: 300,
            strategyId: uint8(IRangeExitServiceManager.StrategyId.Asset0ToAave),
            owner: owner
        });
        bool isValidPosition = rangeExitManagerService.validatePositionForWithdraw(userConfig, positionManager);
        assert(!isValidPosition);
    }
}
