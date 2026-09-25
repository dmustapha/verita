// File: test/GuardCoverage.t.sol
// SPDX-License-Identifier: MIT
// Broad coverage: LiquidationGuard deposit/borrow/repay/health + Undercollateralized + underwater liquidation.
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Verita, IVerita} from "../src/Verita.sol";
import {LiquidationGuard} from "../src/LiquidationGuard.sol";

contract Tok2 {
    uint8 public decimals; string public symbol;
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    constructor(uint8 d, string memory s){decimals=d;symbol=s;}
    function mint(address to,uint256 a) external {balanceOf[to]+=a;}
    function approve(address s,uint256 a) external returns(bool){allowance[msg.sender][s]=a;return true;}
    function transfer(address to,uint256 a) external returns(bool){balanceOf[msg.sender]-=a;balanceOf[to]+=a;return true;}
    function transferFrom(address f,address t,uint256 a) external returns(bool){allowance[f][msg.sender]-=a;balanceOf[f]-=a;balanceOf[t]+=a;return true;}
}

contract GuardCoverageTest is Test {
    Verita verita; Tok2 usdg; Tok2 wtslax; LiquidationGuard guard;
    address borrower = address(0xB0B);
    address att = address(0xA77E);
    address liquidator = address(0x11B);

    function setUp() public {
        usdg = new Tok2(6, "USDG");
        wtslax = new Tok2(18, "wTSLAx");
        verita = new Verita(address(usdg), 10_000_000, 0, 50, 300); // perReadFee 0 for arithmetic clarity
        guard = new LiquidationGuard(address(verita), address(wtslax), address(usdg), 5000); // 50% LTV
        usdg.mint(address(guard), 1_000_000_000);
        wtslax.mint(borrower, 10 ether);
        usdg.mint(att, 100_000_000);
        vm.startPrank(att); usdg.approve(address(verita), type(uint256).max);
        verita.stake(10_000_000);
        verita.attest(address(wtslax), 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days)); // $380.12
        vm.stopPrank();
    }

    function _reattest(uint256 price8dp) internal {
        vm.prank(att);
        verita.attest(address(wtslax), price8dp, IVerita.MarketStatus.REGULAR, uint64(block.timestamp + 1 days));
    }

    // deposit -> borrow -> repay reduces debt correctly
    function test_DepositBorrowRepayFlow() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);            // ~$380.12 collateral -> maxDebt ~190.06 USDG
        guard.borrow(100_000000);          // 100 USDG
        (, uint256 debt1) = guard.positions(borrower);
        assertEq(debt1, 100_000000);
        usdg.approve(address(guard), type(uint256).max);
        guard.repay(40_000000);            // repay 40
        (, uint256 debt2) = guard.positions(borrower);
        assertEq(debt2, 60_000000);
        vm.stopPrank();
    }

    // borrowing beyond LTV reverts Undercollateralized
    function test_BorrowRevertsUndercollateralized() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);            // maxDebt ~190.06 USDG
        vm.expectRevert(LiquidationGuard.Undercollateralized.selector);
        guard.borrow(200_000000);          // 200 USDG > max
        vm.stopPrank();
    }

    // health factor = maxDebt/debt in bps; ~2x when borrowing half of max
    function test_HealthFactorBps() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);
        guard.borrow(95_030000);           // half of 190.06 max
        vm.stopPrank();
        uint256 hf = guard.healthFactorBps(borrower);
        assertEq(hf, 20000);               // 2.0x
    }

    // an underwater position (price dropped) can be liquidated; collateral is seized
    function test_LiquidateUnderwaterSeizes() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);
        guard.borrow(190_000000);          // near max at $380.12
        vm.stopPrank();
        _reattest(20000000000);            // price drops to $200.00 -> maxDebt ~100 < debt 190 -> underwater
        uint256 before = wtslax.balanceOf(liquidator);
        vm.prank(liquidator);
        guard.liquidate(borrower);
        assertEq(wtslax.balanceOf(liquidator) - before, 1 ether); // seized collateral
        (uint256 coll, uint256 debt) = guard.positions(borrower);
        assertEq(coll, 0); assertEq(debt, 0);
    }

    // healthy position cannot be liquidated (guard already tests Healthy; re-assert with a fresh mark)
    function test_HealthyPositionSafeFromLiquidation() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);
        guard.borrow(50_000000);           // well within LTV
        vm.stopPrank();
        vm.prank(liquidator);
        vm.expectRevert(LiquidationGuard.Healthy.selector);
        guard.liquidate(borrower);
    }
}
