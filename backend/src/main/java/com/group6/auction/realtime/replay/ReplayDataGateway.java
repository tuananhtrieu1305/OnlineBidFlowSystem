package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ReplayDataGateway {
    Optional<ReplayAuctionData> findAuction(long auctionId);

    boolean participantExists(long auctionId, long userId);

    List<ReplayBidData> bidsForAuction(long auctionId);

    List<ReplayChatData> chatMessagesForAuction(long auctionId);

    List<ReplayHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime);
}
