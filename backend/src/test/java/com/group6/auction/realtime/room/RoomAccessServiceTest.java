package com.group6.auction.realtime.room;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RoomAccessServiceTest {
    private final FakeRoomDataGateway gateway = new FakeRoomDataGateway();
    private final RoomAccessService service = new RoomAccessService(gateway);

    @Test
    void allowsPublicRunningRoom() {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));

        var result = service.validateJoin(2L, 1L, null);

        assertThat(result.allowed()).isTrue();
    }

    @Test
    void allowsPrivateRoomWithMatchingCode() {
        gateway.auctions.put(3L, AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "CAMERA26", 5));

        var result = service.validateJoin(2L, 3L, "CAMERA26");

        assertThat(result.allowed()).isTrue();
    }

    @Test
    void rejectsPrivateRoomWithMissingCode() {
        gateway.auctions.put(3L, AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "CAMERA26", 5));

        var result = service.validateJoin(2L, 3L, null);

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("ROOM_CODE_REQUIRED");
    }

    @Test
    void rejectsPrivateRoomWithWrongCode() {
        gateway.auctions.put(3L, AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "CAMERA26", 5));

        var result = service.validateJoin(2L, 3L, "WRONG");

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("ROOM_CODE_INVALID");
    }

    @Test
    void rejectsUnknownAuction() {
        var result = service.validateJoin(2L, 99L, null);

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("AUCTION_NOT_FOUND");
    }

    @Test
    void rejectsFullPrivateRoomForNewParticipant() {
        gateway.auctions.put(3L, AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "CAMERA26", 1));
        gateway.participantCounts.put(3L, 1L);

        var result = service.validateJoin(2L, 3L, "CAMERA26");

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("ROOM_FULL");
    }

    @Test
    void allowsExistingParticipantToRejoinFullRoom() {
        gateway.auctions.put(3L, AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "CAMERA26", 1));
        gateway.participantCounts.put(3L, 1L);
        gateway.participants.put(key(3L, 2L), true);

        var result = service.validateJoin(2L, 3L, "CAMERA26");

        assertThat(result.allowed()).isTrue();
    }

    private static String key(long auctionId, long userId) {
        return auctionId + ":" + userId;
    }

    private static final class FakeRoomDataGateway implements RoomDataGateway {
        private final Map<Long, AuctionRoomDetails> auctions = new HashMap<>();
        private final Map<Long, Long> participantCounts = new HashMap<>();
        private final Map<String, Boolean> participants = new HashMap<>();

        @Override
        public Optional<AuctionRoomDetails> findAuction(long auctionId) {
            return Optional.ofNullable(auctions.get(auctionId));
        }

        @Override
        public boolean participantExists(long auctionId, long userId) {
            return participants.containsKey(key(auctionId, userId));
        }

        @Override
        public long countParticipants(long auctionId) {
            return participantCounts.getOrDefault(auctionId, 0L);
        }

        @Override
        public void ensureParticipant(long auctionId, long userId) {
            participants.putIfAbsent(key(auctionId, userId), true);
        }
    }
}
