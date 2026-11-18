// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title YinkoRegistry
/// @notice On-chain half of Yinko: two-way name<->agent links, scam reports, and guard verdict attestations.
contract YinkoRegistry {
    IERC721Owner public immutable identityRegistry;

    struct Link {
        address owner;
        uint256 agentId;
        uint64 linkedAt;
    }

    mapping(bytes32 => Link) public links;
    mapping(address => uint32) public reportCount;
    mapping(address => uint32) public blockCount;

    event AgentLinked(bytes32 indexed nameHash, string name, address indexed owner, uint256 indexed agentId);
    event Reported(address indexed target, address indexed reporter, bytes32 reason, string note);
    event Attested(address indexed target, address indexed caller, uint8 verdict, bytes32 reason);

    error NameInvalid();
    error NotAgentOwner();
    error AlreadyLinked();

    constructor(address identityRegistry_) {
        identityRegistry = IERC721Owner(identityRegistry_);
    }

    function linkAgent(string calldata name, uint256 agentId) external {
        if (!_validName(bytes(name))) revert NameInvalid();
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        bytes32 h = keccak256(bytes(name));
        if (links[h].owner != address(0)) revert AlreadyLinked();
        links[h] = Link(msg.sender, agentId, uint64(block.timestamp));
        emit AgentLinked(h, name, msg.sender, agentId);
    }

    function report(address target, bytes32 reason, string calldata note) external {
        reportCount[target] += 1;
        emit Reported(target, msg.sender, reason, note);
    }

    function attest(address target, uint8 verdict, bytes32 reason) external {
        require(verdict <= 2, "bad verdict");
        if (verdict == 2) blockCount[target] += 1;
        emit Attested(target, msg.sender, verdict, reason);
    }

    function _validName(bytes memory b) internal pure returns (bool) {
        if (b.length < 3 || b.length > 15) return false;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7a);
            if (!ok) return false;
        }
        return true;
    }
}
