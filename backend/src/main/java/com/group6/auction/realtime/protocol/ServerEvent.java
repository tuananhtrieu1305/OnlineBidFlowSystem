package com.group6.auction.realtime.protocol;

public record ServerEvent(String type, String requestId, Long auctionId, Object payload, String sentAt) {
}
