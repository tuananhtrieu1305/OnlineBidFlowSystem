package com.group6.auction.realtime.chat;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(JpaChatMessageStore.class)
public class NoopChatMessageStore implements ChatMessageStore {
    private final AtomicLong ids = new AtomicLong();

    @Override
    public ChatMessageSnapshot save(long auctionId, long userId, String username, String content, Instant sentAt) {
        return new ChatMessageSnapshot(ids.incrementAndGet(), auctionId, userId, username, content, sentAt.toString());
    }

    @Override
    public List<ChatMessageSnapshot> latestMessages(long auctionId, int limit) {
        return List.of();
    }
}
