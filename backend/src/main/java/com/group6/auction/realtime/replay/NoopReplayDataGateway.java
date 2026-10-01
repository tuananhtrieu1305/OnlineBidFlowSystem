package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(JpaReplayDataGateway.class)
public class NoopReplayDataGateway implements ReplayDataGateway {
    @Override
    public Optional<ReplayAuctionData> findAuction(long auctionId) {
        return Optional.empty();
    }

    @Override
    public boolean participantExists(long auctionId, long userId) {
        return false;
    }

    @Override
    public List<ReplayBidData> bidsForAuction(long auctionId) {
        return List.of();
    }

    @Override
    public List<ReplayChatData> chatMessagesForAuction(long auctionId) {
        return List.of();
    }

    @Override
    public List<ReplayHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime) {
        return List.of();
    }
}
