// File: script/DeployMainnet.s.sol
// Live mainnet-196 deploy for the HERO organic-divergence slash proof.
// Settlement token = WOKB (AMEND-3: USDG dormant on X Layer / no retail liquidity; disclosed in LIMITATIONS).
// Contracts unchanged — money token is a constructor param. Beneficiary = BORROWER (harmed party receives the slash).
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Verita} from "../src/Verita.sol";

contract DeployMainnet is Script {
    address constant WOKB   = 0xe538905cf8410324e03A5A23C1c177a474D59b2b; // 18dp wrapped native OKB
    address constant WTSLAX = 0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address reporter = vm.envAddress("REPORTER_ADDRESS");
        address borrower = vm.envAddress("BORROWER_ADDR");

        vm.startBroadcast(pk);
        // minStake 0.005 WOKB, fee 0.0005 WOKB, 50 bps divergence, 300s maxAge
        Verita verita = new Verita(WOKB, 5_000_000_000_000_000, 500_000_000_000_000, 50, 300);
        verita.setReporter(reporter, true);
        verita.registerBeneficiary(WTSLAX, borrower); // set-once: the harmed borrower receives the slash
        vm.stopBroadcast();

        console2.log("VERITA", address(verita));
        console2.log("REPORTER", reporter);
        console2.log("BENEFICIARY(BORROWER)", borrower);
    }
}
