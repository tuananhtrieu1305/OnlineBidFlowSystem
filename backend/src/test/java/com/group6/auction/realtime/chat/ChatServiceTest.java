package com.group6.auction.realtime.chat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.realtime.room.AuctionRoomDetails;
import com.group6.auction.realtime.room.AuctionRoomStatus;
import com.group6.auction.realtime.room.RoomAccessService;
import com.group6.auction.realtime.room.RoomDataGateway;
import com.group6.auction.realtime.room.RoomMembershipService;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ChatServiceTest {
    private final FakeRoomDataGateway roomGateway = new FakeRoomDataGateway();
    private final FakeChatMessageStore store = new FakeChatMessageStore();
    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-30T10:00:00Z"));
    private final RoomMembershipService membershipService =
            new RoomMembershipService(new RoomAccessService(roomGateway), roomGateway);
    private final ChatAntiSpamService antiSpamService = new ChatAntiSpamService(clock, Duration.ofSeconds(2));
    private final ChatService service = new ChatService(membershipService, roomGateway, store, antiSpamService, clock);
    private final RealtimePrincipal alice = new RealtimePrincipal(2L, "alice", RealtimePrincipal.Role.USER);

    @Test
    void sendsChatWhenUserIsInRoom() {
        roomGateway.auctions.put(3L, AuctionRoomDetails.publicRoom(3L, AuctionRoomStatus.RUNNING));
        membershipService.join("session-1", alice, 3L, null);

        var result = service.sendMessage("session-1", alice, 3L, "  Ready for auction.  ");

        assertThat(result.allowed()).isTrue();
        assertThat(result.message()).isNotNull();
        assertThat(result.message().content()).isEqualTo("Ready for auction.");
        assertThat(store.messages).hasSize(1);
    }

    @Test
    void rejectsUserThatHasNotJoinedRoom() {
        roomGateway.auctions.put(3L, AuctionRoomDetails.publicRoom(3L, AuctionRoomStatus.RUNNING));

        var result = service.sendMessage("session-1", alice, 3L, "hello");

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("NOT_IN_ROOM");
        assertThat(store.messages).isEmpty();
    }

    @Test
    void rejectsStaleMembershipWhenAuctionNoLongerExists() {
        roomGateway.auctions.put(3L, AuctionRoomDetails.publicRoom(3L, AuctionRoomStatus.RUNNING));
        membershipService.join("session-1", alice, 3L, null);
        roomGateway.auctions.clear();

        var result = service.sendMessage("session-1", alice, 3L, "hello");

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("AUCTION_NOT_FOUND");
    }

    @Test
    void rejectsEmptyMessage() {
        roomGateway.auctions.put(3L, AuctionRoomDetails.publicRoom(3L, AuctionRoomStatus.RUNNING));
        membershipService.join("session-1", alice, 3L, null);

        var result = service.sendMessage("session-1", alice, 3L, "   ");

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("CHAT_EMPTY");
    }

    @Test
    void rejectsTooLongMessage() {
        roomGateway.auctions.put(3L, AuctionRoomDetails.publicRoom(3L, AuctionRoomStatus.RUNNING));
        membershipService.join("session-1", alice, 3L, null);

        var result = service.sendMessage("session-1", alice, 3L, "x".repeat(501));

        assertThat(result.allowed()).isFalse();
        assertThat(result.errorCode()).isEqualTo("CHAT_TOO_LONG");
    }

    @Test
    void rejectsSpamWithinCooldownAndAllowsAfterCooldown() {
        roomGateway.auctions.put(3L, AuctionRoomDetails.publicRoom(3L, AuctionRoomStatus.RUNNING));
        membershipService.join("session-1", alice, 3L, null);

        assertThat(service.sendMessage("session-1", alice, 3L, "first").allowed()).isTrue();
        assertThat(service.sendMessage("session-1", alice, 3L, "second").errorCode()).isEqualTo("CHAT_RATE_LIMITED");

        clock.advance(Duration.ofSeconds(2));

        assertThat(service.sendMessage("session-1", alice, 3L, "third").allowed()).isTrue();
        assertThat(store.messages).hasSize(2);
    }

    private static String key(long auctionId, long userId) {
        return auctionId + ":" + userId;
    }

    private static final class FakeRoomDataGateway implements RoomDataGateway {
        private final Map<Long, AuctionRoomDetails> auctions = new HashMap<>();
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
            return participants.keySet().stream().filter(key -> key.startsWith(auctionId + ":")).count();
        }

        @Override
        public void ensureParticipant(long auctionId, long userId) {
            participants.putIfAbsent(key(auctionId, userId), true);
        }
    }

    private static final class FakeChatMessageStore implements ChatMessageStore {
        private final List<ChatMessageSnapshot> messages = new ArrayList<>();

        @Override
        public ChatMessageSnapshot save(long auctionId, long userId, String username, String content, Instant sentAt) {
            var message = new ChatMessageSnapshot(messages.size() + 1L, auctionId, userId, username, content, sentAt.toString());
            messages.add(message);
            return message;
        }

        @Override
        public List<ChatMessageSnapshot> latestMessages(long auctionId, int limit) {
            return messages.stream().filter(message -> message.auctionId() == auctionId).limit(limit).toList();
        }
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }
    }
}
