package com.group6.auction.realtime.room;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import com.group6.auction.realtime.chat.ChatMessageSnapshot;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(JpaAuctionSnapshotDataGateway.class)
public class NoopAuctionSnapshotDataGateway implements AuctionSnapshotDataGateway {
    @Override
    public Optional<AuctionSnapshotAuction> findAuction(long auctionId) {
        return Optional.empty();
    }

    @Override
    public List<AuctionSnapshotBid> bidsForAuction(long auctionId) {
        return List.of();
    }

    @Override
    public List<AuctionSnapshotHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime) {
        return List.of();
    }

    @Override
    public List<ChatMessageSnapshot> chatHistoryFor(long auctionId, int limit) {
        return List.of();
    }
}
