package com.group6.auction.realtime.room;

import java.util.Optional;

public interface RoomDataGateway {
    Optional<AuctionRoomDetails> findAuction(long auctionId);

    boolean participantExists(long auctionId, long userId);

    long countParticipants(long auctionId);

    void ensureParticipant(long auctionId, long userId);

    /** Test/probe fallback. Persistent gateways must override with one database transaction. */
    default RoomAccessResult authorizeAndRegister(long userId, long auctionId, String roomCode) {
        var result = new RoomAccessService(this).validateJoin(userId, auctionId, roomCode);
        if (result.allowed() && !participantExists(auctionId, userId)) ensureParticipant(auctionId, userId);
        return result;
    }
}
