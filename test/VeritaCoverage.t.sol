// File: test/VeritaCoverage.t.sol
// SPDX-License-Identifier: MIT
// Broad coverage: every remaining external function + every custom error path on Verita.
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Verita, IVerita} from "../src/Verita.sol";

contract MockUSDG2 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function decimals() external pure returns (uint8) { return 6; }
    function symbol() external pure returns (string memory) { return "USDG"; }
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
}

contract VeritaCoverageTest is Test {
    Verita verita;
    MockUSDG2 usdg;
    address asset = address(0xBEEF);
    address asset2 = address(0xBEE2);
    uint256 reporterPk = 0xA11CE;
    address reporter;
    address attester = address(0xA77E);
    address consumer = address(0xC0FFEE);
    address stranger = address(0xDEAD);

    function setUp() public {
        usdg = new MockUSDG2();
        verita = new Verita(address(usdg), 10_000_000, 10_000, 50, 300);
        reporter = vm.addr(reporterPk);
        verita.setReporter(reporter, true);
        usdg.mint(attester, 100_000_000);
        usdg.mint(consumer, 100_000_000);
        vm.prank(attester); usdg.approve(address(verita), type(uint256).max);
        vm.prank(consumer); usdg.approve(address(verita), type(uint256).max);
    }

    function _stakeAndAttest(uint256 price, IVerita.MarketStatus s) internal {
        vm.startPrank(attester);
        verita.stake(10_000_000);
        verita.attest(asset, price, s, uint64(block.timestamp + 1 days));
        vm.stopPrank();
    }

    function _signReport(address a, uint256 price, uint8 status, uint256 nonce)
        internal view returns (IVerita.ReporterReport memory r)
    {
        r = IVerita.ReporterReport({asset: a, price: price, status: status, timestampNs: uint64(block.timestamp), nonce: nonce, sig: ""});
        bytes32 typehash = keccak256("ReporterReport(address asset,uint256 price,uint8 status,uint64 timestampNs,uint256 nonce)");
        bytes32 structHash = keccak256(abi.encode(typehash, r.asset, r.price, r.status, r.timestampNs, r.nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", verita.domainSeparator(), structHash));
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(reporterPk, digest);
        r.sig = abi.encodePacked(rr, s, v);
    }

    // ---- safePrice error paths ----
    function test_SafePriceRevertsNoAttestation() public {
        vm.prank(consumer);
        vm.expectRevert(Verita.NoAttestation.selector);
        verita.safePrice(asset);
    }

    function test_SafePriceRevertsWhenDiverged() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        IVerita.ReporterReport memory r = _signReport(asset, 40000000000, uint8(IVerita.MarketStatus.REGULAR), 1);
        vm.prank(stranger); verita.challenge(asset, r); // latch diverged
        vm.prank(consumer);
        vm.expectRevert(Verita.Diverged.selector);
        verita.safePrice(asset);
    }

    // ---- isTradeable across states (free view, no fee, no revert) ----
    function test_IsTradeableAcrossStates() public {
        assertEq(verita.isTradeable(asset), false); // no attestation
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        assertEq(verita.isTradeable(asset), true); // fresh REGULAR
        vm.warp(block.timestamp + 301);
        assertEq(verita.isTradeable(asset), false); // stale
    }

    function test_IsTradeableFalseWhenHalted() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.HALTED);
        assertEq(verita.isTradeable(asset), false);
    }

    // ---- challenge error paths ----
    function test_ChallengeRevertsNoAttestation() public {
        IVerita.ReporterReport memory r = _signReport(asset, 40000000000, uint8(IVerita.MarketStatus.REGULAR), 2);
        vm.prank(stranger);
        vm.expectRevert(Verita.NoAttestation.selector);
        verita.challenge(asset, r);
    }

    function test_ChallengeRevertsBadReportAsset() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        // report signed for asset2 but submitted under asset
        IVerita.ReporterReport memory r = _signReport(asset2, 40000000000, uint8(IVerita.MarketStatus.REGULAR), 3);
        vm.prank(stranger);
        vm.expectRevert(Verita.BadReportAsset.selector);
        verita.challenge(asset, r);
    }

    function test_ChallengeRevertsOnReplay() public {
        vm.startPrank(attester);
        verita.stake(30_000_000);
        verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        IVerita.ReporterReport memory r = _signReport(asset, 40000000000, uint8(IVerita.MarketStatus.REGULAR), 4);
        vm.prank(stranger); verita.challenge(asset, r); // first use OK
        // re-attest so there is a live attestation again, then replay the same signed report
        vm.prank(attester); verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.prank(stranger);
        vm.expectRevert(Verita.ReportReplayed.selector);
        verita.challenge(asset, r);
    }

    // ---- withdrawStake ----
    function test_WithdrawStakeRevertsWhenLocked() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR); // stakes exactly minStake, all locked
        vm.prank(attester);
        vm.expectRevert(Verita.StakeLocked.selector);
        verita.withdrawStake(1);
    }

    function test_WithdrawFreeStakeSucceeds() public {
        vm.startPrank(attester);
        verita.stake(25_000_000);
        verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days)); // locks 10
        uint256 before = usdg.balanceOf(attester);
        verita.withdrawStake(15_000_000); // free portion
        assertEq(usdg.balanceOf(attester) - before, 15_000_000);
        assertEq(verita.stakeOf(attester), 10_000_000);
        vm.stopPrank();
    }

    // ---- owner-gated setters ----
    function test_SettersRevertForNonOwner() public {
        bytes memory err = abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger);
        vm.startPrank(stranger);
        vm.expectRevert(err); verita.setReporter(stranger, true);
        vm.expectRevert(err); verita.setMaxAge(999);
        vm.expectRevert(err); verita.setPerReadFee(1);
        vm.expectRevert(err); verita.setDivergenceBps(10);
        vm.stopPrank();
    }

    function test_OwnerUpdatesConfig() public {
        verita.setMaxAge(600);
        verita.setPerReadFee(20_000);
        verita.setDivergenceBps(100);
        assertEq(verita.maxAge(), 600);
        assertEq(verita.perReadFee(), 20_000);
        assertEq(verita.divergenceBps(), 100);
    }

    // ---- beneficiary payout + feePot ----
    function test_RegisteredBeneficiaryReceivesSlash() public {
        address beneficiary = address(0xB0FF);
        verita.registerBeneficiary(asset, beneficiary);
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        IVerita.ReporterReport memory r = _signReport(asset, 40000000000, uint8(IVerita.MarketStatus.REGULAR), 7);
        uint256 before = usdg.balanceOf(beneficiary);
        vm.prank(stranger); verita.challenge(asset, r);
        assertEq(usdg.balanceOf(beneficiary) - before, 10_000_000); // slash paid to registered beneficiary, not challenger
    }

    function test_FeePotAccumulates() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        assertEq(verita.feePot(), 0);
        vm.prank(consumer); verita.safePrice(asset);
        assertEq(verita.feePot(), 10_000); // one per-read fee banked
    }
}
