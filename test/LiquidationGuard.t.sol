// File: test/LiquidationGuard.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Verita, IVerita} from "../src/Verita.sol";
import {LiquidationGuard} from "../src/LiquidationGuard.sol";

// Reuse a minimal ERC20 with configurable decimals
contract Tok {
    uint8 public decimals; string public symbol;
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    constructor(uint8 d, string memory s){decimals=d;symbol=s;}
    function mint(address to,uint256 a) external {balanceOf[to]+=a;}
    function approve(address s,uint256 a) external returns(bool){allowance[msg.sender][s]=a;return true;}
    function transfer(address to,uint256 a) external returns(bool){balanceOf[msg.sender]-=a;balanceOf[to]+=a;return true;}
    function transferFrom(address f,address t,uint256 a) external returns(bool){allowance[f][msg.sender]-=a;balanceOf[f]-=a;balanceOf[t]+=a;return true;}
}

contract GuardTest is Test {
    Verita verita; Tok usdg; Tok wtslax; LiquidationGuard guard;
    address borrower = address(0xB0B);

    function setUp() public {
        usdg = new Tok(6, "USDG");
        wtslax = new Tok(18, "wTSLAx");
        verita = new Verita(address(usdg), 10_000_000, 0, 50, 300); // fee 0 for guard test simplicity
        guard = new LiquidationGuard(address(verita), address(wtslax), address(usdg), 5000);
        usdg.mint(address(guard), 1_000_000_000);
        wtslax.mint(borrower, 10 ether);
        // attester stakes + attests healthy REGULAR at 380.12
        address att = address(0xA77E); usdg.mint(att, 100_000_000);
        vm.startPrank(att); usdg.approve(address(verita), type(uint256).max);
        verita.stake(10_000_000);
        verita.attest(address(wtslax), 38012000000, IVerita.MarketStatus.REGULAR, uint64(block.timestamp+1 days));
        vm.stopPrank();
    }

    function test_BorrowThenLiquidateRefusedOnHalt() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);        // 1 wTSLAx ~ $380 collateral
        guard.borrow(100_000_000);     // borrow 100 USDG (< 50% LTV of ~380)
        vm.stopPrank();
        // attester flips to HALTED
        vm.prank(address(0xA77E));
        verita.attest(address(wtslax), 38012000000, IVerita.MarketStatus.HALTED, uint64(block.timestamp+1 days));
        // wrongful liquidation refused
        vm.expectRevert(Verita.MarketNotOpen.selector);
        guard.liquidate(borrower);
    }

    function test_LiquidateHealthyReverts() public {
        vm.startPrank(borrower);
        wtslax.approve(address(guard), 1 ether);
        guard.deposit(1 ether);
        guard.borrow(100_000_000);
        vm.stopPrank();
        vm.expectRevert(LiquidationGuard.Healthy.selector);
        guard.liquidate(borrower);
    }
}
