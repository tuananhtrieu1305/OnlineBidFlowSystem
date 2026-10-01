package com.group6.auction.realtime.chat;

public record ChatMessageSnapshot(
        long messageId,
        long auctionId,
        long userId,
        String username,
        String content,
        String sentAt
) {
}
