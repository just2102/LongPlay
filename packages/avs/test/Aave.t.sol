// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {console} from "forge-std/console.sol";
import {Test} from "forge-std/Test.sol";
import {RangeExitManagerService} from "../src/RangeExitManagerService.sol";
import {IPositionManagerMinimal} from "../src/interfaces/IPositionManagerMinimal.sol";
import {IRangeExitServiceManager} from "../src/interfaces/IRangeExitServiceManager.sol";
import {ILPRebalanceHook} from "../src/interfaces/ILPRebalanceHook.sol";

contract AaveTest is Test {
    RangeExitManagerService public rangeExitManagerService;
    IPositionManagerMinimal public positionManager;

    function setUp() public {
        address serviceAddress = vm.envAddress("SERVICE_ADDRESS");
        rangeExitManagerService = RangeExitManagerService(serviceAddress);
    }

    function test_isCurrencySuppliableAave() public view {
        bool isSuppliable =
            rangeExitManagerService.isCurrencySuppliableAave(address(0x0000000000000000000000000000000000000000));
        assert(!isSuppliable);

        // WIF
        isSuppliable =
            rangeExitManagerService.isCurrencySuppliableAave(address(0x886c869cDc619214138C87f1DB0ADa522b16Dfa3));
        assert(!isSuppliable);

        // WETH
        isSuppliable =
            rangeExitManagerService.isCurrencySuppliableAave(address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));
        assert(isSuppliable);

        // USDC
        isSuppliable =
            rangeExitManagerService.isCurrencySuppliableAave(address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48));
        assert(isSuppliable);
    }
}
