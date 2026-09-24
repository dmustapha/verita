// File: src/LiquidationGuard.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IVerita} from "./interfaces/IVerita.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidationGuard — thin reference consumer. Holds wTSLAx collateral, issues USDG debt,
/// marks positions via Verita, and REFUSES to liquidate when Verita refuses a mark.
contract LiquidationGuard is ReentrancyGuard {
    IVerita public immutable verita;
    IERC20 public immutable collateral; // wTSLAx
    IERC20 public immutable usdg;       // USDG (6dp)
    uint256 public immutable collDecimals;
    uint256 public immutable ltvBps;    // e.g. 5000 = 50%

    struct Position { uint256 collateral; uint256 debt; } // collateral in token units, debt in USDG (6dp)
    mapping(address => Position) public positions;

    error Undercollateralized();
    error Healthy();

    constructor(address _verita, address _collateral, address _usdg, uint256 _ltvBps) {
        verita = IVerita(_verita);
        collateral = IERC20(_collateral);
        usdg = IERC20(_usdg);
        collDecimals = IERC20(_collateral).decimals();
        ltvBps = _ltvBps;
        // register self so a slash on this asset pays the harmed borrower via this guard
        IVerita(_verita).registerBeneficiary(_collateral, address(this));
        // approve Verita to pull the per-read USDG fee on every safePrice() call (else borrow/liquidate
        // revert on the fee leg). The guard must also HOLD USDG (funded at Seed) for lending + fees.
        IERC20(_usdg).approve(_verita, type(uint256).max);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(collateral.transferFrom(msg.sender, address(this), amount), "coll transferFrom");
        positions[msg.sender].collateral += amount;
    }

    /// @dev collateral USD value normalized to USDG 6dp: coll * price(1e8) / 1e(collDecimals+8-6)
    function _collateralUsdg6(uint256 collAmt, uint256 price8dp) internal view returns (uint256) {
        return (collAmt * price8dp) / (10 ** (collDecimals + 8 - 6));
    }

    function borrow(uint256 usdgAmount) external nonReentrant {
        uint256 price = verita.safePrice(address(collateral)); // reverts on bad mark
        Position storage p = positions[msg.sender];
        uint256 maxDebt = _collateralUsdg6(p.collateral, price) * ltvBps / 10_000;
        if (p.debt + usdgAmount > maxDebt) revert Undercollateralized();
        p.debt += usdgAmount;
        require(usdg.transfer(msg.sender, usdgAmount), "usdg out");
    }

    function repay(uint256 usdgAmount) external nonReentrant {
        require(usdg.transferFrom(msg.sender, address(this), usdgAmount), "repay in");
        positions[msg.sender].debt -= usdgAmount;
    }

    /// @notice Liquidate only on a VALID mark. If Verita refuses the mark, this reverts (wrongful liquidation refused).
    function liquidate(address borrower) external nonReentrant {
        uint256 price = verita.safePrice(address(collateral)); // reverts on halted/stale/diverged
        Position storage p = positions[borrower];
        uint256 collVal = _collateralUsdg6(p.collateral, price);
        uint256 maxDebt = collVal * ltvBps / 10_000;
        if (p.debt <= maxDebt) revert Healthy();
        // underwater: seize collateral (thin reference — full auction out of scope)
        uint256 seized = p.collateral;
        p.collateral = 0;
        p.debt = 0;
        require(collateral.transfer(msg.sender, seized), "seize");
    }

    function healthFactorBps(address borrower) external returns (uint256) {
        uint256 price = verita.safePrice(address(collateral));
        Position storage p = positions[borrower];
        if (p.debt == 0) return type(uint256).max;
        uint256 maxDebt = _collateralUsdg6(p.collateral, price) * ltvBps / 10_000;
        return maxDebt * 10_000 / p.debt;
    }
}
