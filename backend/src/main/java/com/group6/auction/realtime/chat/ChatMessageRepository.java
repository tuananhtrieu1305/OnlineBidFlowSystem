package com.group6.auction.realtime.chat;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findTop100ByAuctionIdOrderBySentAtDesc(Long auctionId);

    List<ChatMessageEntity> findByAuctionIdOrderBySentAtAsc(Long auctionId);
}
