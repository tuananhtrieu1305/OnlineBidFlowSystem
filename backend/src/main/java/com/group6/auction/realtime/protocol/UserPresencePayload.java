package com.group6.auction.realtime.protocol;

public record UserPresencePayload(long auctionId, long userId, String username) {
}
