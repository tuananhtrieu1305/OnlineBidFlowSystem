package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;

public record ReplayChatData(
        long messageId,
        long auctionId,
        long userId,
        String username,
        String content,
        LocalDateTime sentAt
) {
}
