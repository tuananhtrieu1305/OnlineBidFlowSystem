package com.group6.auction.realtime.room;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import com.group6.auction.realtime.chat.ChatMessageSnapshot;

public interface AuctionSnapshotDataGateway {
    Optional<AuctionSnapshotAuction> findAuction(long auctionId);

    List<AuctionSnapshotBid> bidsForAuction(long auctionId);

    List<AuctionSnapshotHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime);

    List<ChatMessageSnapshot> chatHistoryFor(long auctionId, int limit);
}
