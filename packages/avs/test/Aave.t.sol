// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {console} from "forge-std/console.sol";
import {Test} from "forge-std/Test.sol";
import {RangeExitManagerService} from "../src/RangeExitManagerService.sol";
import {IPositionManagerMinimal} from "../src/interfaces/IPositionManagerMinimal.sol";
import {IRangeExitServiceManager} from "../src/interfaces/IRangeExitServiceManager.sol";
import {ILPRebalanceHook} from "../src/interfaces/ILPRebalanceHook.sol";
import {IPool} from "../src/interfaces/IAavePool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {DataTypes} from "../src/libraries/AaveDataTypes.sol";

contract AaveTest is Test {
    using SafeERC20 for IERC20;

    RangeExitManagerService public avs;
    IPositionManagerMinimal public positionManager;
    IPool public AAVE_POOL;

    function setUp() public {
        address serviceAddress = vm.envAddress("SERVICE_ADDRESS");
        avs = RangeExitManagerService(serviceAddress);
        AAVE_POOL = IPool(vm.envAddress("AAVE_POOL_ADDRESS"));
    }

    function test_isCurrencySuppliableAave() public view {
        bool isSuppliable = avs.isCurrencySuppliableAave(address(0x0000000000000000000000000000000000000000));
        assert(!isSuppliable);

        // WIF
        isSuppliable = avs.isCurrencySuppliableAave(address(0x886c869cDc619214138C87f1DB0ADa522b16Dfa3));
        assert(!isSuppliable);

        isSuppliable = avs.isCurrencySuppliableAave(address(0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5));
        assert(isSuppliable);
    }
}
