// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {YinkoRegistry} from "../src/YinkoRegistry.sol";

contract Deploy is Script {
    function run() external {
        address identity = vm.envAddress("IDENTITY_REGISTRY");
        vm.startBroadcast();
        YinkoRegistry reg = new YinkoRegistry(identity);
        vm.stopBroadcast();
        console.log("YinkoRegistry deployed at:", address(reg));
    }
}
