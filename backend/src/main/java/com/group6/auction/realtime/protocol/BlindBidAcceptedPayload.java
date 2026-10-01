package com.group6.auction.realtime.protocol;

public record BlindBidAcceptedPayload(long auctionId, long amount, String bidRef) {
}
