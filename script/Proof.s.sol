// File: script/Proof.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Verita, IVerita} from "../src/Verita.sol";

/// Posts a DIVERGENT attestation (attacker) then submits a relayer-signed independent report to slash.
/// The independent report bytes are produced by relayer/src/sign.ts and passed via env.
contract Proof is Script {
    function run() external {
        Verita verita = Verita(vm.envAddress("VERITA"));
        address wtslax = vm.envAddress("WTSLAX");

        // attacker posts a divergent price (organic divergence source for the slash)
        uint256 badPk = vm.envUint("ATTACKER_PK");
        vm.startBroadcast(badPk);
        // attacker must be staked; stake first in a prior step. Post a price far from the independent stream.
        verita.attest(wtslax, vm.envUint("BAD_PRICE_8DP"), IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.stopBroadcast();

        // challenge with the independent signed report (built off-chain)
        IVerita.ReporterReport memory r = IVerita.ReporterReport({
            asset: wtslax,
            price: vm.envUint("REPORT_PRICE_8DP"),
            status: uint8(vm.envUint("REPORT_STATUS")),
            timestampNs: uint64(vm.envUint("REPORT_TS_NS")),
            nonce: vm.envUint("REPORT_NONCE"),
            sig: vm.envBytes("REPORT_SIG")
        });
        uint256 anyPk = vm.envUint("BORROWER_PK");
        vm.startBroadcast(anyPk);
        verita.challenge(wtslax, r);
        vm.stopBroadcast();
    }
}
