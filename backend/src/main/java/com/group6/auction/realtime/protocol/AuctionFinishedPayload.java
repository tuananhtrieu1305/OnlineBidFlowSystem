package com.group6.auction.realtime.protocol;

public record AuctionFinishedPayload(long auctionId, String status, Long winnerUserId, Long winningPrice) {
}
