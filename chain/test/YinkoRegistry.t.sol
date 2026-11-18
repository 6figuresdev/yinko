// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {YinkoRegistry} from "../src/YinkoRegistry.sol";

contract MockIdentity {
    mapping(uint256 => address) public owners;
    function mint(uint256 id, address to) external { owners[id] = to; }
    function ownerOf(uint256 id) external view returns (address) {
        require(owners[id] != address(0), "nonexistent");
        return owners[id];
    }
}

contract YinkoRegistryTest is Test {
    YinkoRegistry reg;
    MockIdentity id;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        id = new MockIdentity();
        reg = new YinkoRegistry(address(id));
        id.mint(7, alice);
    }

    function test_linkAgent_ownerCanLink() public {
        vm.prank(alice);
        reg.linkAgent("yinko", 7);
        (address o, uint256 agentId, ) = reg.links(keccak256("yinko"));
        assertEq(o, alice);
        assertEq(agentId, 7);
    }

    function test_linkAgent_nonOwnerReverts() public {
        vm.prank(bob);
        vm.expectRevert(YinkoRegistry.NotAgentOwner.selector);
        reg.linkAgent("yinko", 7);
    }

    function test_linkAgent_duplicateReverts() public {
        vm.startPrank(alice);
        reg.linkAgent("yinko", 7);
        vm.expectRevert(YinkoRegistry.AlreadyLinked.selector);
        reg.linkAgent("yinko", 7);
        vm.stopPrank();
    }

    function test_linkAgent_invalidNames() public {
        vm.startPrank(alice);
        vm.expectRevert(YinkoRegistry.NameInvalid.selector);
        reg.linkAgent("ab", 7);
        vm.expectRevert(YinkoRegistry.NameInvalid.selector);
        reg.linkAgent("Yinko", 7);
        vm.expectRevert(YinkoRegistry.NameInvalid.selector);
        reg.linkAgent("sixteencharsname", 7);
        vm.expectRevert(YinkoRegistry.NameInvalid.selector);
        reg.linkAgent("yin-ko", 7);
        vm.stopPrank();
    }

    function test_report_countsAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit YinkoRegistry.Reported(bob, alice, "POISONING", "lookalike");
        vm.prank(alice);
        reg.report(bob, "POISONING", "lookalike");
        assertEq(reg.reportCount(bob), 1);
    }

    function test_attest_blockIncrements_andRejectsBadVerdict() public {
        reg.attest(bob, 2, "ADDRESS_POISONING");
        assertEq(reg.blockCount(bob), 1);
        reg.attest(bob, 0, "OK");
        assertEq(reg.blockCount(bob), 1);
        vm.expectRevert(bytes("bad verdict"));
        reg.attest(bob, 3, "X");
    }
}
