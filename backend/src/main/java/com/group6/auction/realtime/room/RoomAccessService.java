package com.group6.auction.realtime.room;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RoomAccessService {
    private final RoomDataGateway roomDataGateway;

    public RoomAccessService(RoomDataGateway roomDataGateway) {
        this.roomDataGateway = roomDataGateway;
    }

    public RoomAccessResult validateJoin(long userId, long auctionId, String roomCode) {
        if (userId <= 0 || auctionId <= 0) {
            return RoomAccessResult.denied("INVALID_MESSAGE", "auctionId and userId must be positive.");
        }

        var room = roomDataGateway.findAuction(auctionId);
        if (room.isEmpty()) {
            return RoomAccessResult.denied("AUCTION_NOT_FOUND", "Auction room was not found.");
        }

        var details = room.get();
        if (!details.joinable()) {
            return RoomAccessResult.denied("AUCTION_NOT_JOINABLE", "Auction room is not open for joining.");
        }

        if (details.accessType() == AuctionRoomAccessType.PRIVATE) {
            var normalizedCode = normalize(roomCode);
            if (!StringUtils.hasText(normalizedCode)) {
                return RoomAccessResult.denied("ROOM_CODE_REQUIRED", "Room code is required.");
            }
            if (!normalizedCode.equals(details.roomCode())) {
                return RoomAccessResult.denied("ROOM_CODE_INVALID", "Room code is invalid.");
            }
        }

        var alreadyParticipant = roomDataGateway.participantExists(auctionId, userId);
        var maxParticipants = details.maxParticipants();
        if (!alreadyParticipant && maxParticipants != null && maxParticipants > 0
                && roomDataGateway.countParticipants(auctionId) >= maxParticipants) {
            return RoomAccessResult.denied("ROOM_FULL", "Auction room is full.");
        }

        return RoomAccessResult.success();
    }

    private String normalize(String roomCode) {
        return roomCode == null ? null : roomCode.trim();
    }
}
