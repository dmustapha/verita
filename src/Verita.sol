// File: src/Verita.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IVerita} from "./interfaces/IVerita.sol";
import {ReportVerifier} from "./libraries/ReportVerifier.sol";

/// @title Verita — staked/slashable safe-price + market-status primitive for tokenized equities on X Layer 196.
contract Verita is IVerita, EIP712, Ownable, ReentrancyGuard {
    using ReportVerifier for ReporterReport;

    IERC20 public immutable USDG;        // 0x4ae4...2dc8, 6 decimals
    uint256 public immutable minStake;   // in USDG (6dp)
    uint256 public perReadFee;           // in USDG (6dp)
    uint256 public divergenceBps;        // e.g. 50 = 0.5%
    uint256 public maxAge;               // seconds an attestation stays fresh

    struct Attestation {
        uint256 price;      // 8dp USD
        MarketStatus status;
        uint64 timestamp;
        uint64 expiry;
        address attester;
        bool diverged;      // set true once a valid challenge proved divergence
    }

    mapping(address asset => Attestation) public attestations;
    mapping(address attester => uint256) public stakeOf;
    mapping(address attester => uint256) public lockedOf;   // TOTAL stake locked behind this attester's live attestations
    mapping(address attester => mapping(address asset => uint256)) public lockedForAsset; // exact per-(attester,asset) lock
    mapping(address reporter => bool) public reporters;     // authorized independent signers
    mapping(bytes32 => bool) public usedReports;            // replay guard (signer,asset,nonce)
    mapping(address asset => address) public slashBeneficiary; // consumer registers who a slash pays (SET-ONCE)
    uint256 public feePot;

    error InsufficientStake();
    error NoAttestation();
    error StaleAttestation();
    error MarketNotOpen();
    error Diverged();
    error NotAReporter();
    error NoDivergence();
    error BadReportAsset();
    error ReportReplayed();
    error StakeLocked();
    error BeneficiaryAlreadySet();

    constructor(address usdg, uint256 _minStake, uint256 _perReadFee, uint256 _divergenceBps, uint256 _maxAge)
        EIP712("Verita", "1")
        Ownable(msg.sender)
    {
        USDG = IERC20(usdg);
        minStake = _minStake;
        perReadFee = _perReadFee;
        divergenceBps = _divergenceBps;
        maxAge = _maxAge;
    }

    // ---- config ----
    function setReporter(address reporter, bool allowed) external onlyOwner { reporters[reporter] = allowed; }
    function setPerReadFee(uint256 f) external onlyOwner { perReadFee = f; }
    function setDivergenceBps(uint256 b) external onlyOwner { divergenceBps = b; }
    function setMaxAge(uint256 a) external onlyOwner { maxAge = a; }
    /// @dev SET-ONCE: the first caller (the consumer's constructor) binds the beneficiary; it can never be overwritten.
    /// Front-running the very first registration for a fresh asset is disclosed in SECURITY.md "Not defended against".
    function registerBeneficiary(address asset, address beneficiary) external {
        if (slashBeneficiary[asset] != address(0)) revert BeneficiaryAlreadySet();
        slashBeneficiary[asset] = beneficiary;
    }
    function domainSeparator() external view returns (bytes32) { return _domainSeparatorV4(); }

    // ---- staking ----
    function stake(uint256 amount) external nonReentrant {
        require(USDG.transferFrom(msg.sender, address(this), amount), "transferFrom");
        stakeOf[msg.sender] += amount;
    }

    function withdrawStake(uint256 amount) external nonReentrant {
        uint256 free = stakeOf[msg.sender] - lockedOf[msg.sender];
        if (amount > free) revert StakeLocked();
        stakeOf[msg.sender] -= amount;
        require(USDG.transfer(msg.sender, amount), "transfer");
    }

    // ---- attestation (HEADLINE invariant: no attestation without FREE staked USDG at risk) ----
    function attest(address asset, uint256 price, MarketStatus status, uint64 expiry) external {
        Attestation memory prev = attestations[asset];
        // 1) release the previous attester's EXACT lock for THIS asset (whoever it was, incl. msg.sender re-attesting)
        if (prev.attester != address(0)) {
            uint256 rel = lockedForAsset[prev.attester][asset];
            if (rel > 0) {
                lockedForAsset[prev.attester][asset] = 0;
                lockedOf[prev.attester] -= rel;
            }
        }
        // 2) require FREE stake (total minus everything still locked) — one stake cannot back two assets
        if (stakeOf[msg.sender] - lockedOf[msg.sender] < minStake) revert InsufficientStake();
        // 3) lock exactly minStake for this (attester, asset)
        lockedForAsset[msg.sender][asset] = minStake;
        lockedOf[msg.sender] += minStake;

        attestations[asset] = Attestation({
            price: price,
            status: status,
            timestamp: uint64(block.timestamp),
            expiry: expiry,
            attester: msg.sender,
            diverged: false
        });
        emit Attested(asset, price, uint8(status), msg.sender, expiry);
    }

    // ---- consumer reads ----
    function _tradeable(Attestation memory a) internal view returns (bool) {
        if (a.attester == address(0)) return false;
        if (a.diverged) return false;
        if (block.timestamp > a.expiry) return false;
        if (block.timestamp - a.timestamp > maxAge) return false;
        // tradeable session set only; HALTED/SPLIT_PENDING/DEPEGGED/CLOSED/UNKNOWN revert
        if (!(a.status == MarketStatus.PRE || a.status == MarketStatus.REGULAR
            || a.status == MarketStatus.POST || a.status == MarketStatus.OVERNIGHT)) return false;
        return true;
    }

    function isTradeable(address asset) external view returns (bool) {
        return _tradeable(attestations[asset]);
    }

    /// @notice reverts on stale/halted/split/divergent input; charges a per-read USDG fee.
    function safePrice(address asset) external nonReentrant returns (uint256) {
        Attestation memory a = attestations[asset];
        if (a.attester == address(0)) revert NoAttestation();
        if (a.diverged) revert Diverged();
        if (block.timestamp > a.expiry || block.timestamp - a.timestamp > maxAge) revert StaleAttestation();
        if (!(a.status == MarketStatus.PRE || a.status == MarketStatus.REGULAR
            || a.status == MarketStatus.POST || a.status == MarketStatus.OVERNIGHT)) revert MarketNotOpen();

        if (perReadFee > 0) {
            require(USDG.transferFrom(msg.sender, address(this), perReadFee), "fee");
            feePot += perReadFee;
            emit FeeCollected(msg.sender, perReadFee);
        }
        emit SafePriceRead(asset, msg.sender, a.price, perReadFee);
        return a.price;
    }

    // ---- challenge + slash (U7: organic divergence only) ----
    function challenge(address asset, ReporterReport calldata report) external nonReentrant {
        if (report.asset != asset) revert BadReportAsset();

        address signer = report.recoverSigner(_domainSeparatorV4());
        if (!reporters[signer]) revert NotAReporter();

        bytes32 key = keccak256(abi.encodePacked(signer, asset, report.nonce));
        if (usedReports[key]) revert ReportReplayed();

        Attestation storage a = attestations[asset];
        if (a.attester == address(0)) revert NoAttestation();

        bool priceDiverged = _diverges(a.price, report.price);
        bool statusContradicts = (uint8(a.status) != report.status)
            && (report.status == uint8(MarketStatus.HALTED)
                || report.status == uint8(MarketStatus.CLOSED)
                || report.status == uint8(MarketStatus.SPLIT_PENDING)
                || report.status == uint8(MarketStatus.DEPEGGED));

        if (!priceDiverged && !statusContradicts) revert NoDivergence();

        usedReports[key] = true;
        a.diverged = true;

        // slash the attester's EXACT per-asset lock to the harmed beneficiary; release the lock fully.
        address attester = a.attester;
        uint256 locked = lockedForAsset[attester][asset];
        uint256 amount = locked;
        if (stakeOf[attester] < amount) amount = stakeOf[attester]; // safety clamp (should never bind)
        lockedForAsset[attester][asset] = 0;
        lockedOf[attester] -= locked;   // release the full lock (accounting stays consistent)
        stakeOf[attester] -= amount;    // remove the slashed principal

        address beneficiary = slashBeneficiary[asset];
        if (beneficiary == address(0)) beneficiary = msg.sender;

        require(USDG.transfer(beneficiary, amount), "slash transfer");
        emit Slashed(asset, attester, beneficiary, amount, priceDiverged ? "price-divergence" : "status-contradiction");
    }

    function _diverges(uint256 attested, uint256 reported) internal view returns (bool) {
        uint256 diff = attested > reported ? attested - reported : reported - attested;
        // diff/attested > divergenceBps/10000
        return diff * 10_000 > attested * divergenceBps;
    }
}
