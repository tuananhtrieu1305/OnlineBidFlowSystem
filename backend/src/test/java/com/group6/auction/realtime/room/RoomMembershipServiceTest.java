package com.group6.auction.realtime.room;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RoomMembershipServiceTest {
    private final FakeRoomDataGateway gateway = new FakeRoomDataGateway();
    private final RoomAccessService accessService = new RoomAccessService(gateway);
    private final RoomMembershipService service = new RoomMembershipService(accessService, gateway);
    private final RealtimePrincipal alice = new RealtimePrincipal(2L, "alice", RealtimePrincipal.Role.USER);

    @Test
    void joinsMultipleRoomsForSameUser() {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        gateway.auctions.put(2L, AuctionRoomDetails.publicRoom(2L, AuctionRoomStatus.UPCOMING));

        assertThat(service.join("session-1", alice, 1L, null).allowed()).isTrue();
        assertThat(service.join("session-1", alice, 2L, null).allowed()).isTrue();

        assertThat(service.auctionIdsForSession("session-1")).containsExactlyInAnyOrder(1L, 2L);
        assertThat(gateway.ensureParticipantCalls).isEqualTo(2);
    }

    @Test
    void joinIsIdempotentForSameSessionAndRoom() {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));

        var firstJoin = service.join("session-1", alice, 1L, null);
        var secondJoin = service.join("session-1", alice, 1L, null);

        assertThat(firstJoin.allowed()).isTrue();
        assertThat(firstJoin.changed()).isTrue();
        assertThat(secondJoin.allowed()).isTrue();
        assertThat(secondJoin.changed()).isFalse();
        assertThat(service.sessionIdsForAuction(1L)).containsExactly("session-1");
        assertThat(gateway.ensureParticipantCalls).isEqualTo(1);
    }

    @Test
    void disconnectingOldSessionDoesNotRemoveNewSessionForSameUser() {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        service.join("old-session", alice, 1L, null);
        service.join("new-session", alice, 1L, null);

        var leftRooms = service.disconnect("old-session");

        assertThat(leftRooms).containsExactly(1L);
        assertThat(service.sessionIdsForAuction(1L)).containsExactly("new-session");
        assertThat(service.auctionIdsForSession("new-session")).containsExactly(1L);
    }

    @Test
    void leaveRemovesMembership() {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        service.join("session-1", alice, 1L, null);

        var result = service.leave("session-1", alice, 1L);

        assertThat(result.allowed()).isTrue();
        assertThat(service.sessionIdsForAuction(1L)).isEmpty();
    }

    @Test
    void leaveRejectsSessionThatIsNotInRoom() {
        var result = service.leave("session-1", alice, 1L);

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("NOT_IN_ROOM");
    }

    @Test
    void disconnectCleansAllMembershipsForSession() {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        gateway.auctions.put(2L, AuctionRoomDetails.publicRoom(2L, AuctionRoomStatus.RUNNING));
        service.join("session-1", alice, 1L, null);
        service.join("session-1", alice, 2L, null);

        var leftRooms = service.disconnect("session-1");

        assertThat(leftRooms).containsExactlyInAnyOrder(1L, 2L);
        assertThat(service.auctionIdsForSession("session-1")).isEmpty();
        assertThat(service.sessionIdsForAuction(1L)).isEmpty();
        assertThat(service.sessionIdsForAuction(2L)).isEmpty();
    }

    private static String key(long auctionId, long userId) {
        return auctionId + ":" + userId;
    }

    private static final class FakeRoomDataGateway implements RoomDataGateway {
        private final Map<Long, AuctionRoomDetails> auctions = new HashMap<>();
        private final Map<String, Boolean> participants = new HashMap<>();
        private int ensureParticipantCalls;

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
            return participants.keySet().stream().filter(key -> key.startsWith(auctionId + ":")).count();
        }

        @Override
        public void ensureParticipant(long auctionId, long userId) {
            if (!participants.containsKey(key(auctionId, userId))) {
                ensureParticipantCalls++;
            }
            participants.putIfAbsent(key(auctionId, userId), true);
        }
    }
}
