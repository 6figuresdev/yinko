// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {YinkoWatch} from "../src/YinkoWatch.sol";

contract DeployWatch is Script {
    // SPACE ID Agent ID registry on BNB Smart Chain mainnet. The script refuses to run on any other chain.
    address constant AGENT_ID_MAINNET = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    function run() external {
        require(block.chainid == 56, "mainnet only");
        require(AGENT_ID_MAINNET.code.length > 0, "Agent ID registry not found");
        vm.startBroadcast();
        YinkoWatch w = new YinkoWatch(AGENT_ID_MAINNET);
        vm.stopBroadcast();
        console.log("YinkoWatch deployed at:", address(w));
    }
}
