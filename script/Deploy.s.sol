// File: script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Verita} from "../src/Verita.sol";
import {LiquidationGuard} from "../src/LiquidationGuard.sol";

contract Deploy is Script {
    // X Layer 196 (SOURCE LOCK — INVARIANTS.md)
    address constant USDG   = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8; // 6dp
    address constant WTSLAX = 0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);

        // minStake 10 USDG, fee 0.01 USDG, 50 bps divergence, 300s maxAge
        Verita verita = new Verita(USDG, 10_000_000, 10_000, 50, 300);
        LiquidationGuard guard = new LiquidationGuard(address(verita), WTSLAX, USDG, 5000); // 50% LTV

        address reporter = vm.envAddress("REPORTER_ADDRESS");
        verita.setReporter(reporter, true);

        vm.stopBroadcast();
        console2.log("VERITA", address(verita));
        console2.log("GUARD", address(guard));
    }
}
