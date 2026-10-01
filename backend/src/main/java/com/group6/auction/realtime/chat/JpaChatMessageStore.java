package com.group6.auction.realtime.chat;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import com.group6.auction.account.repository.UserRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Primary
public class JpaChatMessageStore implements ChatMessageStore {
    private final ObjectProvider<ChatMessageRepository> repository;
    private final ObjectProvider<UserRepository> userRepository;
    private final AtomicLong fallbackIds = new AtomicLong();

    public JpaChatMessageStore(ObjectProvider<ChatMessageRepository> repository, ObjectProvider<UserRepository> userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public ChatMessageSnapshot save(long auctionId, long userId, String username, String content, Instant sentAt) {
        var chatRepository = repository.getIfAvailable();
        if (chatRepository == null) {
            return new ChatMessageSnapshot(fallbackIds.incrementAndGet(), auctionId, userId, username, content, sentAt.toString());
        }
        var entity = chatRepository.save(new ChatMessageEntity(
                auctionId,
                userId,
                content,
                LocalDateTime.ofInstant(sentAt, ZoneOffset.UTC)
        ));
        return toSnapshot(entity, username);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessageSnapshot> latestMessages(long auctionId, int limit) {
        var chatRepository = repository.getIfAvailable();
        if (chatRepository == null) {
            return List.of();
        }
        var messages = chatRepository.findTop100ByAuctionIdOrderBySentAtDesc(auctionId).stream()
                .limit(Math.max(0, limit))
                .sorted(Comparator.comparing(ChatMessageEntity::getSentAt))
                .toList();
        var usernames = usernamesFor(messages);
        return messages.stream()
                .map(entity -> toSnapshot(entity, usernames.getOrDefault(entity.getUserId(), "user-" + entity.getUserId())))
                .toList();
    }

    private ChatMessageSnapshot toSnapshot(ChatMessageEntity entity, String username) {
        return new ChatMessageSnapshot(
                entity.getId(),
                entity.getAuctionId(),
                entity.getUserId(),
                username,
                entity.getContent(),
                entity.getSentAt().atOffset(ZoneOffset.UTC).toInstant().toString()
        );
    }

    private Map<Long, String> usernamesFor(List<ChatMessageEntity> messages) {
        var userIds = messages.stream().map(ChatMessageEntity::getUserId).distinct().toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        var users = userRepository.getIfAvailable();
        if (users == null) {
            return Map.of();
        }
        return users.findAllById(userIds).stream()
                .collect(Collectors.toMap(user -> user.getId(), user -> user.getUsername()));
    }
}
