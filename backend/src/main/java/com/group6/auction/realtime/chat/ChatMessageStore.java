package com.group6.auction.realtime.chat;

import java.time.Instant;
import java.util.List;

public interface ChatMessageStore {
    ChatMessageSnapshot save(long auctionId, long userId, String username, String content, Instant sentAt);

    List<ChatMessageSnapshot> latestMessages(long auctionId, int limit);
}
