package com.group6.auction.realtime.connection;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.security.Principal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.realtime.protocol.AuctionFinishedPayload;
import com.group6.auction.realtime.protocol.BlindBidAcceptedPayload;
import com.group6.auction.realtime.protocol.NormalPriceUpdatedPayload;
import com.group6.auction.realtime.room.AuctionRoomDetails;
import com.group6.auction.realtime.room.AuctionRoomStatus;
import com.group6.auction.realtime.room.RoomAccessService;
import com.group6.auction.realtime.room.RoomDataGateway;
import com.group6.auction.realtime.room.RoomMembershipService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketExtension;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;

import static org.assertj.core.api.Assertions.assertThat;

class RealtimeEventPublisherTest {
    @Test
    void failedRecipientDoesNotPreventRemainingRecipientsFromReceivingCommittedEvent() throws Exception {
        var registry = org.mockito.Mockito.mock(RealtimeSessionRegistry.class);
        var bad = org.mockito.Mockito.mock(WebSocketSession.class);
        var good = org.mockito.Mockito.mock(WebSocketSession.class);
        org.mockito.Mockito.when(bad.isOpen()).thenReturn(true);
        org.mockito.Mockito.when(good.isOpen()).thenReturn(true);
        org.mockito.Mockito.when(registry.sessionIdsForUser(2L)).thenReturn(new java.util.LinkedHashSet<>(List.of("bad", "good")));
        org.mockito.Mockito.when(registry.sessionById("bad")).thenReturn(Optional.of(bad));
        org.mockito.Mockito.when(registry.sessionById("good")).thenReturn(Optional.of(good));
        org.mockito.Mockito.doThrow(new IOException("disconnected")).when(bad).sendMessage(org.mockito.ArgumentMatchers.any());
        var sender = new RealtimeEventPublisher(new ObjectMapper(), registry, membershipService);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> sender.sendBlindBidAccepted(2L, 3L,
                new BlindBidAcceptedPayload(3L, 100L, "bid-1"))).isInstanceOf(IOException.class);
        org.mockito.Mockito.verify(good).sendMessage(org.mockito.ArgumentMatchers.any(TextMessage.class));
    }
    private final FakeRoomDataGateway gateway = new FakeRoomDataGateway();
    private final RealtimeSessionRegistry sessionRegistry = new RealtimeSessionRegistry();
    private final RoomMembershipService membershipService =
            new RoomMembershipService(new RoomAccessService(gateway), gateway);
    private final RealtimeEventPublisher publisher =
            new RealtimeEventPublisher(new ObjectMapper(), sessionRegistry, membershipService);

    @Test
    void broadcastToAuctionRoomSendsToAllSessionsInRoomOnly() throws Exception {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        gateway.auctions.put(2L, AuctionRoomDetails.publicRoom(2L, AuctionRoomStatus.RUNNING));
        var alice = register("s1", 2L);
        var bob = register("s2", 3L);
        var charlie = register("s3", 4L);
        membershipService.join("s1", principal(2L), 1L, null);
        membershipService.join("s2", principal(3L), 1L, null);
        membershipService.join("s3", principal(4L), 2L, null);

        publisher.broadcastToAuctionRoom(1L, "ROOM_NOTICE", Map.of("message", "hello"));

        assertThat(sentText(alice)).contains("\"type\":\"ROOM_NOTICE\"").contains("\"auctionId\":1");
        assertThat(sentText(bob)).contains("\"type\":\"ROOM_NOTICE\"").contains("\"auctionId\":1");
        assertThat(charlie.sentMessages()).isEmpty();
    }

    @Test
    void sendToUserSendsOnlyTargetUserSessions() throws Exception {
        var aliceDesktop = register("s1", 2L);
        var aliceLaptop = register("s2", 2L);
        var bob = register("s3", 3L);

        publisher.sendToUser(2L, "PRIVATE_NOTICE", 9L, Map.of("ok", true));

        assertThat(sentText(aliceDesktop)).contains("\"type\":\"PRIVATE_NOTICE\"").contains("\"auctionId\":9");
        assertThat(sentText(aliceLaptop)).contains("\"type\":\"PRIVATE_NOTICE\"").contains("\"auctionId\":9");
        assertThat(bob.sentMessages()).isEmpty();
    }

    @Test
    void blindBidAcceptedIsDirectAndNotBroadcastToRoom() throws Exception {
        gateway.auctions.put(3L, AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "VIP", 5));
        var alice = register("s1", 2L);
        var bob = register("s2", 3L);
        membershipService.join("s1", principal(2L), 3L, "VIP");
        membershipService.join("s2", principal(3L), 3L, "VIP");

        publisher.sendBlindBidAccepted(2L, 3L, new BlindBidAcceptedPayload(3L, 1700L, "bid-1"));

        assertThat(sentText(alice)).contains("\"type\":\"BLIND_BID_ACCEPTED\"")
                .contains("\"auctionId\":3")
                .contains("\"amount\":1700");
        assertThat(bob.sentMessages()).isEmpty();
    }

    @Test
    void broadcastNormalPriceUpdatedUsesTypedPayload() throws Exception {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        var alice = register("s1", 2L);
        membershipService.join("s1", principal(2L), 1L, null);

        publisher.broadcastNormalPriceUpdated(1L, new NormalPriceUpdatedPayload(1L, 1500L, 1600L, 2L));

        assertThat(sentText(alice)).contains("\"type\":\"NORMAL_PRICE_UPDATED\"")
                .contains("\"currentPrice\":1500")
                .contains("\"nextMinimumBid\":1600")
                .contains("\"leadingUserId\":2");
    }

    @Test
    void publisherHandlesDisconnectedSessions() throws Exception {
        gateway.auctions.put(1L, AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING));
        var alice = register("s1", 2L);
        alice.close();
        membershipService.join("s1", principal(2L), 1L, null);

        publisher.broadcastAuctionFinished(1L, new AuctionFinishedPayload(1L, "SOLD", 2L, 1500L));

        assertThat(alice.sentMessages()).isEmpty();
    }

    private FakeWebSocketSession register(String sessionId, long userId) {
        var session = new FakeWebSocketSession(sessionId);
        sessionRegistry.register(session, principal(userId));
        return session;
    }

    private RealtimePrincipal principal(long userId) {
        return new RealtimePrincipal(userId, "user-" + userId, RealtimePrincipal.Role.USER);
    }

    private String sentText(FakeWebSocketSession session) {
        return session.sentMessages().stream()
                .map(TextMessage::getPayload)
                .findFirst()
                .orElseThrow();
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

    private static final class FakeWebSocketSession implements WebSocketSession {
        private final String id;
        private final List<TextMessage> sentMessages = new ArrayList<>();
        private boolean open = true;
        private int textMessageSizeLimit;
        private int binaryMessageSizeLimit;

        private FakeWebSocketSession(String id) {
            this.id = id;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public URI getUri() {
            return URI.create("ws://localhost/ws/auction");
        }

        @Override
        public HttpHeaders getHandshakeHeaders() {
            return HttpHeaders.EMPTY;
        }

        @Override
        public Map<String, Object> getAttributes() {
            return Collections.emptyMap();
        }

        @Override
        public Principal getPrincipal() {
            return null;
        }

        @Override
        public InetSocketAddress getLocalAddress() {
            return null;
        }

        @Override
        public InetSocketAddress getRemoteAddress() {
            return null;
        }

        @Override
        public String getAcceptedProtocol() {
            return null;
        }

        @Override
        public void setTextMessageSizeLimit(int messageSizeLimit) {
            this.textMessageSizeLimit = messageSizeLimit;
        }

        @Override
        public int getTextMessageSizeLimit() {
            return textMessageSizeLimit;
        }

        @Override
        public void setBinaryMessageSizeLimit(int messageSizeLimit) {
            this.binaryMessageSizeLimit = messageSizeLimit;
        }

        @Override
        public int getBinaryMessageSizeLimit() {
            return binaryMessageSizeLimit;
        }

        @Override
        public List<WebSocketExtension> getExtensions() {
            return List.of();
        }

        @Override
        public void sendMessage(WebSocketMessage<?> message) throws IOException {
            if (!open) {
                throw new IllegalStateException("closed");
            }
            if (message instanceof TextMessage textMessage) {
                sentMessages.add(textMessage);
            }
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        @Override
        public void close() {
            open = false;
        }

        @Override
        public void close(CloseStatus status) {
            open = false;
        }

        List<TextMessage> sentMessages() {
            return sentMessages;
        }
    }
}
