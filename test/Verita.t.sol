// File: test/Verita.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Verita, IVerita} from "../src/Verita.sol";
import {ReportVerifier} from "../src/libraries/ReportVerifier.sol";

contract MockUSDG {
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

contract VeritaTest is Test {
    Verita verita;
    MockUSDG usdg;
    address asset = address(0xBEEF);
    uint256 reporterPk = 0xA11CE;
    address reporter;
    address attester = address(0xA77E);
    address consumer = address(0xC0FFEE);

    function setUp() public {
        usdg = new MockUSDG();
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

    function test_AttestRevertsWithoutStake() public {
        vm.prank(attester);
        vm.expectRevert(Verita.InsufficientStake.selector);
        verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
    }

    function test_SafePriceReturnsAndChargesFee() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        uint256 before = usdg.balanceOf(consumer);
        vm.prank(consumer);
        uint256 p = verita.safePrice(asset);
        assertEq(p, 38012000000);
        assertEq(before - usdg.balanceOf(consumer), 10_000); // 0.01 USDG fee
    }

    function test_SafePriceRevertsHalted() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.HALTED);
        vm.prank(consumer);
        vm.expectRevert(Verita.MarketNotOpen.selector);
        verita.safePrice(asset);
    }

    function test_SafePriceRevertsStale() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        vm.warp(block.timestamp + 301);
        vm.prank(consumer);
        vm.expectRevert(Verita.StaleAttestation.selector);
        verita.safePrice(asset);
    }

    function _signReport(uint256 price, uint8 status, uint256 nonce)
        internal view returns (IVerita.ReporterReport memory r)
    {
        r = IVerita.ReporterReport({asset: asset, price: price, status: status, timestampNs: uint64(block.timestamp), nonce: nonce, sig: ""});
        bytes32 typehash = keccak256("ReporterReport(address asset,uint256 price,uint8 status,uint64 timestampNs,uint256 nonce)");
        bytes32 structHash = keccak256(abi.encode(typehash, r.asset, r.price, r.status, r.timestampNs, r.nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", verita.domainSeparator(), structHash));
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(reporterPk, digest);
        r.sig = abi.encodePacked(rr, s, v);
    }

    function test_ChallengeSlashesOnOrganicDivergence() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR); // attester says 380.12
        IVerita.ReporterReport memory r = _signReport(40000000000, uint8(IVerita.MarketStatus.REGULAR), 1); // 400.00 (>0.5%)
        uint256 borrowerBefore = usdg.balanceOf(address(0xB0B));
        vm.prank(address(0xB0B));
        verita.challenge(asset, r);
        // no beneficiary registered -> pays challenger (0xB0B)
        assertEq(usdg.balanceOf(address(0xB0B)) - borrowerBefore, 10_000_000);
        vm.prank(consumer);
        vm.expectRevert(Verita.Diverged.selector);
        verita.safePrice(asset);
    }

    function test_ChallengeRevertsWithinBand() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        IVerita.ReporterReport memory r = _signReport(38020000000, uint8(IVerita.MarketStatus.REGULAR), 2); // ~0.002%
        vm.prank(address(0xB0B));
        vm.expectRevert(Verita.NoDivergence.selector);
        verita.challenge(asset, r);
    }

    function test_ChallengeRevertsFromNonReporter() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        verita.setReporter(reporter, false); // revoke
        IVerita.ReporterReport memory r = _signReport(40000000000, uint8(IVerita.MarketStatus.REGULAR), 3);
        vm.prank(address(0xB0B));
        vm.expectRevert(Verita.NotAReporter.selector);
        verita.challenge(asset, r);
    }

    // --- lock-accounting regression tests (independent-review BLOCKERs) ---

    // One 10-USDG stake CANNOT back two assets: the 2nd attest reverts on free-stake.
    function test_CannotDoubleLockAcrossAssets() public {
        address asset2 = address(0xBEE2);
        vm.startPrank(attester);
        verita.stake(10_000_000);                                // exactly minStake
        verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.expectRevert(Verita.InsufficientStake.selector);      // no free stake left
        verita.attest(asset2, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        assertEq(verita.lockedOf(attester), 10_000_000);         // not double-locked
    }

    // Re-attesting the SAME asset releases the old lock and re-locks — net stays minStake, withdrawal of the rest works.
    function test_ReAttestReleasesOldLock() public {
        vm.startPrank(attester);
        verita.stake(30_000_000);
        verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        verita.attest(asset, 39000000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        assertEq(verita.lockedOf(attester), 10_000_000);         // still one lock, not two
        verita.withdrawStake(20_000_000);                        // free portion withdrawable
        vm.stopPrank();
    }

    // After a slash, lock accounting is consistent and the remaining free stake is withdrawable (no underflow-brick).
    function test_WithdrawAfterSlash() public {
        vm.startPrank(attester);
        verita.stake(30_000_000);
        verita.attest(asset, 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        IVerita.ReporterReport memory r = _signReport(40000000000, uint8(IVerita.MarketStatus.REGULAR), 9);
        vm.prank(address(0xB0B));
        verita.challenge(asset, r);                              // slashes the 10 locked
        assertEq(verita.lockedOf(attester), 0);
        assertEq(verita.stakeOf(attester), 20_000_000);
        vm.prank(attester);
        verita.withdrawStake(20_000_000);                        // must NOT revert (StakeLocked/underflow)
    }

    // Slash also fires on a status contradiction (attester says REGULAR; independent report signs HALTED, same price).
    function test_ChallengeSlashesOnStatusContradiction() public {
        _stakeAndAttest(38012000000, IVerita.MarketStatus.REGULAR);
        IVerita.ReporterReport memory r = _signReport(38012000000, uint8(IVerita.MarketStatus.HALTED), 10); // same price, HALTED
        uint256 before = usdg.balanceOf(address(0xB0B));
        vm.prank(address(0xB0B));
        verita.challenge(asset, r);
        assertEq(usdg.balanceOf(address(0xB0B)) - before, 10_000_000);
    }

    // Beneficiary is SET-ONCE — a second registration reverts (anyone-can-redirect BLOCKER fixed).
    function test_BeneficiarySetOnce() public {
        verita.registerBeneficiary(asset, address(0xCAFE));
        vm.expectRevert(Verita.BeneficiaryAlreadySet.selector);
        verita.registerBeneficiary(asset, address(0xBAD));
    }
}
