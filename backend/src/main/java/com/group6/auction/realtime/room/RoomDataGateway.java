package com.group6.auction.realtime.room;

import java.util.Optional;

public interface RoomDataGateway {
    Optional<AuctionRoomDetails> findAuction(long auctionId);

    boolean participantExists(long auctionId, long userId);

    long countParticipants(long auctionId);

    void ensureParticipant(long auctionId, long userId);
}
