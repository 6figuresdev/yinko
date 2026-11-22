// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title YinkoWatch
/// @notice Community trust signals for Yinko's pre-signature guard. Only Agent ID holders can report an address
/// as unsafe or vouch for it. The guard reads these counts and warns when verified agents have flagged a recipient.
/// @dev No owner, no admin, no fees, no funds. The Agent ID registry address is fixed at deployment.
/// Names are never stored or looked up: signals are about addresses only.
contract YinkoWatch {
    IAgentID public immutable agentId;

    /// @notice Distinct Agent ID holder addresses that have reported or vouched at least once.
    uint32 public participants;

    mapping(address => bool) public hasParticipated;
    mapping(address => uint32) public reportCount;   // target => reports from distinct holders
    mapping(address => uint32) public vouchCount;    // target => vouches from distinct holders
    // reporter => target => 0 none, 1 reported, 2 vouched. One signal per pair, so nobody can stack votes.
    mapping(address => mapping(address => uint8)) public signalOf;

    event Reported(address indexed target, address indexed reporter, bytes32 reason, string note);
    event Vouched(address indexed target, address indexed voucher);

    error NotAnAgentIdHolder();
    error InvalidTarget();
    error AlreadySignalled();
    error NoteTooLong();

    uint256 public constant MAX_NOTE_BYTES = 140;

    constructor(address agentId_) {
        agentId = IAgentID(agentId_);
    }

    /// @notice Report `target` as unsafe (poisoned address, fake agent wallet, malicious spender...).
    function report(address target, bytes32 reason, string calldata note) external {
        _checkSignal(target);
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong();
        signalOf[msg.sender][target] = 1;
        reportCount[target] += 1;
        _participate();
        emit Reported(target, msg.sender, reason, note);
    }

    /// @notice Vouch for `target` as trustworthy.
    function vouch(address target) external {
        _checkSignal(target);
        signalOf[msg.sender][target] = 2;
        vouchCount[target] += 1;
        _participate();
        emit Vouched(target, msg.sender);
    }

    /// @notice Both counts in one read, for the guard.
    function signalsOf(address target) external view returns (uint32 reports, uint32 vouches) {
        return (reportCount[target], vouchCount[target]);
    }

    function isAgentIdHolder(address who) external view returns (bool) {
        return agentId.balanceOf(who) > 0;
    }

    function _checkSignal(address target) internal view {
        if (agentId.balanceOf(msg.sender) == 0) revert NotAnAgentIdHolder();
        if (target == address(0) || target == msg.sender) revert InvalidTarget();
        if (signalOf[msg.sender][target] != 0) revert AlreadySignalled();
    }

    function _participate() internal {
        if (!hasParticipated[msg.sender]) {
            hasParticipated[msg.sender] = true;
            participants += 1;
        }
    }
}
