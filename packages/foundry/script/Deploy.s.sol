// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import "forge-std/console2.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {LPRebalanceHook} from "../src/LPRebalanceHook.sol";

contract Deploy is Script {
    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);
    address OWNER = vm.envAddress("USER");

    function run() public {
        address poolManagerAddr = vm.envOr({name: "POOL_MANAGER", defaultValue: address(0)});
        require(poolManagerAddr != address(0), "Set POOL_MANAGER env var");

        uint160 flags = uint160(Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_INITIALIZE_FLAG);

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManagerAddr), OWNER);

        (address expectedHookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(LPRebalanceHook).creationCode, constructorArgs);

        vm.startBroadcast();
        LPRebalanceHook hook = new LPRebalanceHook{salt: salt}(IPoolManager(poolManagerAddr), OWNER);
        vm.stopBroadcast();

        require(address(hook) == expectedHookAddress, "Deploy: hook address mismatch");

        console2.log("Hook deployed to:", address(hook));
    }
}
