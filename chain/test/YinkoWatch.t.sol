// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {YinkoWatch} from "../src/YinkoWatch.sol";

contract MockAgentID {
    mapping(address => uint256) public balanceOf;
    function mint(address to) external { balanceOf[to] = 1; }
}

contract YinkoWatchTest is Test {
    YinkoWatch watch;
    MockAgentID aid;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    address outsider = address(0xDEAD1);
    address bad = address(0xBAD);

    function setUp() public {
        aid = new MockAgentID();
        watch = new YinkoWatch(address(aid));
        aid.mint(alice); aid.mint(bob); aid.mint(carol);
    }

    function test_report_countsAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit YinkoWatch.Reported(bad, alice, "POISONING", "copies my address");
        vm.prank(alice);
        watch.report(bad, "POISONING", "copies my address");
        (uint32 r, uint32 v) = watch.signalsOf(bad);
        assertEq(r, 1);
        assertEq(v, 0);
        assertEq(watch.participants(), 1);
    }

    function test_vouch_counts() public {
        vm.prank(alice);
        watch.vouch(bad);
        (uint32 r, uint32 v) = watch.signalsOf(bad);
        assertEq(r, 0);
        assertEq(v, 1);
    }

    function test_nonHolderCannotSignal() public {
        vm.startPrank(outsider);
        vm.expectRevert(YinkoWatch.NotAnAgentIdHolder.selector);
        watch.report(bad, "X", "");
        vm.expectRevert(YinkoWatch.NotAnAgentIdHolder.selector);
        watch.vouch(bad);
        vm.stopPrank();
    }

    function test_oneSignalPerPair_noStackingNoFlipping() public {
        vm.startPrank(alice);
        watch.report(bad, "X", "");
        vm.expectRevert(YinkoWatch.AlreadySignalled.selector);
        watch.report(bad, "X", "");
        vm.expectRevert(YinkoWatch.AlreadySignalled.selector);
        watch.vouch(bad);
        vm.stopPrank();
    }

    function test_distinctHoldersAccumulate_participantsCountOnce() public {
        vm.prank(alice); watch.report(bad, "X", "");
        vm.prank(bob); watch.report(bad, "X", "");
        vm.prank(carol); watch.vouch(bad);
        vm.prank(alice); watch.vouch(address(0x1234)); // second action by alice, still one participant
        (uint32 r, uint32 v) = watch.signalsOf(bad);
        assertEq(r, 2);
        assertEq(v, 1);
        assertEq(watch.participants(), 3);
    }

    function test_invalidTargets() public {
        vm.startPrank(alice);
        vm.expectRevert(YinkoWatch.InvalidTarget.selector);
        watch.report(address(0), "X", "");
        vm.expectRevert(YinkoWatch.InvalidTarget.selector);
        watch.vouch(alice);
        vm.stopPrank();
    }

    function test_noteLimit() public {
        bytes memory ok = new bytes(140);
        bytes memory tooLong = new bytes(141);
        for (uint256 i; i < ok.length; ++i) ok[i] = "a";
        for (uint256 i; i < tooLong.length; ++i) tooLong[i] = "a";
        vm.startPrank(alice);
        watch.report(bad, "X", string(ok));
        vm.expectRevert(YinkoWatch.NoteTooLong.selector);
        watch.report(address(0x77), "X", string(tooLong));
        vm.stopPrank();
    }

    function test_isAgentIdHolder() public view {
        assertTrue(watch.isAgentIdHolder(alice));
        assertFalse(watch.isAgentIdHolder(outsider));
    }
}
