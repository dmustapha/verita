// File: src/interfaces/IVerita.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerita {
    enum MarketStatus { UNKNOWN, PRE, REGULAR, POST, OVERNIGHT, CLOSED, HALTED, SPLIT_PENDING, DEPEGGED }

    struct ReporterReport {
        address asset;
        uint256 price;      // 8-decimal USD price
        uint8   status;     // MarketStatus
        uint64  timestampNs;
        uint256 nonce;
        bytes   sig;        // EIP-712 signature over the report (sig excluded from the hash)
    }

    // consumer-facing
    function isTradeable(address asset) external view returns (bool);
    function safePrice(address asset) external returns (uint256 price); // non-view: charges fee, reverts on unsafe

    // attester-facing
    function stake(uint256 amount) external;
    function withdrawStake(uint256 amount) external;
    function attest(address asset, uint256 price, MarketStatus status, uint64 expiry) external;

    // anyone: prove divergence to slash
    function challenge(address asset, ReporterReport calldata report) external;

    // consumer registers (set-once) who a slash on this asset pays
    function registerBeneficiary(address asset, address beneficiary) external;

    event Attested(address indexed asset, uint256 price, uint8 status, address indexed attester, uint64 expiry);
    event SafePriceRead(address indexed asset, address indexed consumer, uint256 price, uint256 fee);
    event Slashed(address indexed asset, address indexed attester, address indexed beneficiary, uint256 amount, string reason);
    event FeeCollected(address indexed consumer, uint256 amount);
}
