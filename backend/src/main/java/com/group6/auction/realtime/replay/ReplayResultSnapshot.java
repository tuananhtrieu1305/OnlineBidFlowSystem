package com.group6.auction.realtime.replay;

public record ReplayResultSnapshot(String status, Long winnerUserId, Long winningPrice, String finishedAt) {
}
