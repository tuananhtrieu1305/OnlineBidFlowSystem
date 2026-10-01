package com.group6.auction.realtime.room;

import java.util.Optional;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(JpaRoomDataGateway.class)
public class NoopRoomDataGateway implements RoomDataGateway {
    @Override
    public Optional<AuctionRoomDetails> findAuction(long auctionId) {
        return Optional.empty();
    }

    @Override
    public boolean participantExists(long auctionId, long userId) {
        return false;
    }

    @Override
    public long countParticipants(long auctionId) {
        return 0;
    }

    @Override
    public void ensureParticipant(long auctionId, long userId) {
    }
}
