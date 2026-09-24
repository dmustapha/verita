// File: script/Seed.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Verita, IVerita} from "../src/Verita.sol";
import {LiquidationGuard} from "../src/LiquidationGuard.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// Stakes the attester, funds the guard with USDG liquidity, opens a healthy wTSLAx position,
/// and posts the first REGULAR attestation so the console is live at N=1.
contract Seed is Script {
    function run() external {
        Verita verita = Verita(vm.envAddress("VERITA"));
        LiquidationGuard guard = LiquidationGuard(vm.envAddress("GUARD"));
        IERC20 usdg = IERC20(verita.USDG());
        address wtslax = vm.envAddress("WTSLAX");
        uint256 price = vm.envUint("SEED_PRICE_8DP"); // e.g. 38012000000 (380.12)

        // attester
        uint256 attPk = vm.envUint("ATTESTER_PK");
        vm.startBroadcast(attPk);
        // approve + stake 10 USDG then attest REGULAR
        // (note: also fund the GUARD with USDG and have it approve Verita for per-read fees — see Seed notes below)
        (bool ok,) = address(usdg).call(abi.encodeWithSignature("approve(address,uint256)", address(verita), 10_000_000));
        require(ok, "approve");
        verita.stake(10_000_000);
        verita.attest(wtslax, price, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.stopBroadcast();

        // borrower: deposit wTSLAx, borrow USDG
        uint256 borPk = vm.envUint("BORROWER_PK");
        vm.startBroadcast(borPk);
        uint256 collAmt = vm.envUint("SEED_COLL"); // wTSLAx units
        (bool ok2,) = address(wtslax).call(abi.encodeWithSignature("approve(address,uint256)", address(guard), collAmt));
        require(ok2, "coll approve");
        guard.deposit(collAmt);
        guard.borrow(vm.envUint("SEED_BORROW")); // < maxDebt
        vm.stopBroadcast();
    }
}
