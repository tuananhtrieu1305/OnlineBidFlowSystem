package com.group6.auction.realtime.room;

public record AuctionRoomDetails(
        long auctionId,
        AuctionRoomAccessType accessType,
        AuctionRoomStatus status,
        String roomCode,
        Integer maxParticipants
) {
    public static AuctionRoomDetails publicRoom(long auctionId, AuctionRoomStatus status) {
        return new AuctionRoomDetails(auctionId, AuctionRoomAccessType.PUBLIC, status, null, null);
    }

    public static AuctionRoomDetails privateRoom(
            long auctionId,
            AuctionRoomStatus status,
            String roomCode,
            Integer maxParticipants
    ) {
        return new AuctionRoomDetails(auctionId, AuctionRoomAccessType.PRIVATE, status, roomCode, maxParticipants);
    }

    public boolean joinable() {
        return status == AuctionRoomStatus.UPCOMING || status == AuctionRoomStatus.RUNNING;
    }
}
