// File: src/libraries/ReportVerifier.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IVerita} from "../interfaces/IVerita.sol";

/// @dev Recovers the signer of a ReporterReport. The struct hash EXCLUDES the `sig` field.
library ReportVerifier {
    // keccak256("ReporterReport(address asset,uint256 price,uint8 status,uint64 timestampNs,uint256 nonce)")
    bytes32 internal constant REPORT_TYPEHASH =
        keccak256("ReporterReport(address asset,uint256 price,uint8 status,uint64 timestampNs,uint256 nonce)");

    function hashReport(IVerita.ReporterReport calldata r) internal pure returns (bytes32) {
        return keccak256(abi.encode(REPORT_TYPEHASH, r.asset, r.price, r.status, r.timestampNs, r.nonce));
    }

    /// @param domainSeparator the EIP-712 domain separator of the Verita contract
    function recoverSigner(IVerita.ReporterReport calldata r, bytes32 domainSeparator)
        internal
        pure
        returns (address)
    {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, hashReport(r)));
        return ECDSA.recover(digest, r.sig);
    }
}
