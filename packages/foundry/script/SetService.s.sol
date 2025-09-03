// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LPRebalanceHook} from "../src/LPRebalanceHook.sol";

contract SetService is Script {
    function setUp() public {}

    function run() public {
        address hook = vm.envAddress("HOOK");
        if (hook == address(0)) {
            revert("Hook not deployed");
        }
        address service = vm.envAddress("SERVICE");
        if (service == address(0)) {
            revert("Service not deployed");
        }

        vm.startBroadcast();
        LPRebalanceHook(hook).setService(service);
        vm.stopBroadcast();
        console.log("Service set successfully to:", service);
    }
}
