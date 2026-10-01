package com.group6.auction.realtime;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import com.group6.auction.realtime.room.AuctionRoomDetails;
import com.group6.auction.realtime.room.AuctionRoomStatus;
import com.group6.auction.realtime.room.AuctionSnapshotService;
import com.group6.auction.realtime.room.RoomDataGateway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration"
})
class RealtimeWebSocketTest {
    @LocalServerPort
    private int port;

    @MockBean
    private RoomDataGateway roomDataGateway;

    @MockBean
    private AuctionSnapshotService auctionSnapshotService;

    @Test
    void auctionSocketRequiresMockAuth() {
        try (var client = HttpClient.newHttpClient()) {
            assertThatThrownBy(() -> client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri(""), new WebSocket.Listener() {})
                    .get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(WebSocketHandshakeException.class);
        }
    }

    @Test
    void auctionSocketRespondsToJsonPing() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"PING\",\"requestId\":\"req-1\"}", true).get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"PONG\"")
                        .contains("\"requestId\":\"req-1\"")
                        .contains("\"userId\":2")
                        .contains("\"role\":\"USER\"");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void auctionSocketReportsMalformedJson() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{bad-json", true).get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"ERROR\"")
                        .contains("\"code\":\"INVALID_MESSAGE\"");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void auctionSocketReportsUnknownMessageType() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"DO_SOMETHING\"}", true).get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"ERROR\"")
                        .contains("\"code\":\"UNKNOWN_MESSAGE_TYPE\"");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void auctionSocketJoinsPublicRoom() throws Exception {
        when(roomDataGateway.findAuction(1L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING)));
        when(auctionSnapshotService.buildSnapshot(1L, 2L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 1L, "auctionType", "NORMAL")));

        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-1\",\"payload\":{\"auctionId\":1}}", true)
                        .get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"USER_JOINED\"")
                        .contains("\"requestId\":\"join-1\"")
                        .contains("\"auctionId\":1")
                        .contains("\"userId\":2")
                        .contains("\"username\":\"dev-user-2\"");

                assertThat(listener.nextText()).contains("\"type\":\"AUCTION_STATE\"")
                        .contains("\"requestId\":\"join-1\"")
                        .contains("\"auctionId\":1")
                        .contains("\"auctionType\":\"NORMAL\"");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void duplicateJoinSendsFreshStateWithoutSecondPresenceBroadcast() throws Exception {
        when(roomDataGateway.findAuction(10L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(10L, AuctionRoomStatus.RUNNING)));
        when(auctionSnapshotService.buildSnapshot(10L, 2L))
                .thenReturn(
                        Optional.of(java.util.Map.of("auctionId", 10L, "version", "first")),
                        Optional.of(java.util.Map.of("auctionId", 10L, "version", "second"))
                );

        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-1\",\"payload\":{\"auctionId\":10}}", true)
                        .get(5, TimeUnit.SECONDS);
                assertThat(listener.nextText()).contains("\"type\":\"USER_JOINED\"");
                assertThat(listener.nextText()).contains("\"type\":\"AUCTION_STATE\"")
                        .contains("\"requestId\":\"join-1\"")
                        .contains("\"version\":\"first\"");

                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-2\",\"payload\":{\"auctionId\":10}}", true)
                        .get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"AUCTION_STATE\"")
                        .contains("\"requestId\":\"join-2\"")
                        .contains("\"version\":\"second\"");
                assertThat(listener.noTextWithin(250)).isTrue();
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void reconnectedClientCanRestoreMultipleRoomsWithFreshSnapshots() throws Exception {
        when(roomDataGateway.findAuction(11L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(11L, AuctionRoomStatus.RUNNING)));
        when(roomDataGateway.findAuction(12L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(12L, AuctionRoomStatus.RUNNING)));
        when(auctionSnapshotService.buildSnapshot(11L, 2L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 11L, "version", "room-1-fresh")));
        when(auctionSnapshotService.buildSnapshot(12L, 2L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 12L, "version", "room-2-fresh")));

        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"restore-1\",\"payload\":{\"auctionId\":11}}", true)
                        .get(5, TimeUnit.SECONDS);
                assertThat(listener.nextText()).contains("\"type\":\"USER_JOINED\"");
                assertThat(listener.nextText()).contains("\"type\":\"AUCTION_STATE\"")
                        .contains("\"requestId\":\"restore-1\"")
                        .contains("\"version\":\"room-1-fresh\"");

                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"restore-2\",\"payload\":{\"auctionId\":12}}", true)
                        .get(5, TimeUnit.SECONDS);
                assertThat(listener.nextText()).contains("\"type\":\"USER_JOINED\"");
                assertThat(listener.nextText()).contains("\"type\":\"AUCTION_STATE\"")
                        .contains("\"requestId\":\"restore-2\"")
                        .contains("\"version\":\"room-2-fresh\"");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void closingOldSessionDoesNotRemoveReconnectedSessionOrBroadcastUserLeft() throws Exception {
        when(roomDataGateway.findAuction(13L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(13L, AuctionRoomStatus.RUNNING)));
        when(auctionSnapshotService.buildSnapshot(13L, 2L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 13L, "userId", 2L)));
        when(auctionSnapshotService.buildSnapshot(13L, 3L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 13L, "userId", 3L)));

        try (var client = HttpClient.newHttpClient()) {
            var oldAliceListener = new RecordingListener();
            var newAliceListener = new RecordingListener();
            var bobListener = new RecordingListener();
            var oldAlice = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), oldAliceListener)
                    .get(5, TimeUnit.SECONDS);
            var bob = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=3&role=USER"), bobListener)
                    .get(5, TimeUnit.SECONDS);
            WebSocket newAlice = null;
            try {
                oldAlice.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"old-join\",\"payload\":{\"auctionId\":13}}", true)
                        .get(5, TimeUnit.SECONDS);
                oldAliceListener.nextText();
                oldAliceListener.nextText();

                bob.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"bob-join\",\"payload\":{\"auctionId\":13}}", true)
                        .get(5, TimeUnit.SECONDS);
                bobListener.nextText();
                bobListener.nextText();
                oldAliceListener.nextText();

                newAlice = client.newWebSocketBuilder()
                        .header("Origin", "http://localhost:5173")
                        .buildAsync(auctionUri("?userId=2&role=USER"), newAliceListener)
                        .get(5, TimeUnit.SECONDS);
                newAlice.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"new-join\",\"payload\":{\"auctionId\":13}}", true)
                        .get(5, TimeUnit.SECONDS);
                assertThat(newAliceListener.nextText()).contains("\"type\":\"AUCTION_STATE\"")
                        .contains("\"requestId\":\"new-join\"");
                assertThat(bobListener.noTextWithin(250)).isTrue();

                oldAlice.sendClose(WebSocket.NORMAL_CLOSURE, "reconnected").get(5, TimeUnit.SECONDS);
                assertThat(bobListener.noTextWithin(500)).isTrue();

                newAlice.sendText("{\"type\":\"SEND_CHAT_MESSAGE\",\"requestId\":\"chat-after-reconnect\",\"payload\":{\"auctionId\":13,\"content\":\"still here\"}}", true)
                        .get(5, TimeUnit.SECONDS);
                assertThat(bobListener.nextText()).contains("\"type\":\"CHAT_MESSAGE\"")
                        .contains("\"requestId\":\"chat-after-reconnect\"")
                        .contains("\"userId\":2")
                        .contains("\"content\":\"still here\"");
            } finally {
                oldAlice.abort();
                bob.abort();
                if (newAlice != null) {
                    newAlice.abort();
                }
            }
        }
    }

    @Test
    void auctionSocketRejectsWrongPrivateRoomCode() throws Exception {
        when(roomDataGateway.findAuction(3L))
                .thenReturn(Optional.of(AuctionRoomDetails.privateRoom(3L, AuctionRoomStatus.RUNNING, "CAMERA26", 5)));

        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-3\",\"payload\":{\"auctionId\":3,\"roomCode\":\"WRONG\"}}", true)
                        .get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"ERROR\"")
                        .contains("\"requestId\":\"join-3\"")
                        .contains("\"code\":\"ROOM_CODE_INVALID\"");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void auctionSocketLeavesJoinedRoom() throws Exception {
        when(roomDataGateway.findAuction(1L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING)));

        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-1\",\"payload\":{\"auctionId\":1}}", true)
                        .get(5, TimeUnit.SECONDS);
                assertThat(listener.nextText()).contains("\"type\":\"USER_JOINED\"");

                socket.sendText("{\"type\":\"LEAVE_ROOM\",\"requestId\":\"leave-1\",\"payload\":{\"auctionId\":1}}", true)
                        .get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"USER_LEFT\"")
                        .contains("\"requestId\":\"leave-1\"")
                        .contains("\"auctionId\":1")
                        .contains("\"userId\":2");
            } finally {
                socket.abort();
            }
        }
    }

    @Test
    void auctionSocketBroadcastsChatOnlyInsideJoinedRoom() throws Exception {
        when(roomDataGateway.findAuction(1L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING)));
        when(roomDataGateway.findAuction(2L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(2L, AuctionRoomStatus.RUNNING)));
        when(auctionSnapshotService.buildSnapshot(1L, 2L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 1L, "auctionType", "NORMAL")));
        when(auctionSnapshotService.buildSnapshot(1L, 3L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 1L, "auctionType", "NORMAL")));
        when(auctionSnapshotService.buildSnapshot(2L, 4L))
                .thenReturn(Optional.of(java.util.Map.of("auctionId", 2L, "auctionType", "NORMAL")));

        try (var client = HttpClient.newHttpClient()) {
            var aliceListener = new RecordingListener();
            var bobListener = new RecordingListener();
            var charlieListener = new RecordingListener();
            var alice = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), aliceListener)
                    .get(5, TimeUnit.SECONDS);
            var bob = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=3&role=USER"), bobListener)
                    .get(5, TimeUnit.SECONDS);
            var charlie = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=4&role=USER"), charlieListener)
                    .get(5, TimeUnit.SECONDS);
            try {
                alice.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-a\",\"payload\":{\"auctionId\":1}}", true)
                        .get(5, TimeUnit.SECONDS);
                aliceListener.nextText();
                aliceListener.nextText();

                bob.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-b\",\"payload\":{\"auctionId\":1}}", true)
                        .get(5, TimeUnit.SECONDS);
                bobListener.nextText();
                bobListener.nextText();
                aliceListener.nextText();

                charlie.sendText("{\"type\":\"JOIN_ROOM\",\"requestId\":\"join-c\",\"payload\":{\"auctionId\":2}}", true)
                        .get(5, TimeUnit.SECONDS);
                charlieListener.nextText();
                charlieListener.nextText();

                alice.sendText("{\"type\":\"SEND_CHAT_MESSAGE\",\"requestId\":\"chat-1\",\"payload\":{\"auctionId\":1,\"content\":\" Hello room \"}}", true)
                        .get(5, TimeUnit.SECONDS);

                assertThat(aliceListener.nextText()).contains("\"type\":\"CHAT_MESSAGE\"")
                        .contains("\"requestId\":\"chat-1\"")
                        .contains("\"auctionId\":1")
                        .contains("\"userId\":2")
                        .contains("\"content\":\"Hello room\"");
                assertThat(bobListener.nextText()).contains("\"type\":\"CHAT_MESSAGE\"")
                        .contains("\"auctionId\":1")
                        .contains("\"content\":\"Hello room\"");
                assertThat(charlieListener.noTextWithin(250)).isTrue();
            } finally {
                alice.abort();
                bob.abort();
                charlie.abort();
            }
        }
    }

    @Test
    void auctionSocketRejectsChatFromSessionOutsideRoom() throws Exception {
        when(roomDataGateway.findAuction(1L))
                .thenReturn(Optional.of(AuctionRoomDetails.publicRoom(1L, AuctionRoomStatus.RUNNING)));

        try (var client = HttpClient.newHttpClient()) {
            var listener = new RecordingListener();
            var socket = client.newWebSocketBuilder()
                    .header("Origin", "http://localhost:5173")
                    .buildAsync(auctionUri("?userId=2&role=USER"), listener)
                    .get(5, TimeUnit.SECONDS);
            try {
                socket.sendText("{\"type\":\"SEND_CHAT_MESSAGE\",\"requestId\":\"chat-1\",\"payload\":{\"auctionId\":1,\"content\":\"hello\"}}", true)
                        .get(5, TimeUnit.SECONDS);

                assertThat(listener.nextText()).contains("\"type\":\"ERROR\"")
                        .contains("\"requestId\":\"chat-1\"")
                        .contains("\"code\":\"NOT_IN_ROOM\"");
            } finally {
                socket.abort();
            }
        }
    }

    private URI auctionUri(String query) {
        return URI.create("ws://localhost:" + port + "/ws/auction" + query);
    }

    private static final class RecordingListener implements WebSocket.Listener {
        private final LinkedBlockingQueue<String> messages = new LinkedBlockingQueue<>();
        private final StringBuilder buffer = new StringBuilder();

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);
            if (last) {
                messages.add(buffer.toString());
                buffer.setLength(0);
            }
            webSocket.request(1);
            return CompletableFuture.completedFuture(null);
        }

        String nextText() throws Exception {
            return messages.poll(5, TimeUnit.SECONDS);
        }

        boolean noTextWithin(long timeoutMillis) throws InterruptedException {
            return messages.poll(timeoutMillis, TimeUnit.MILLISECONDS) == null;
        }
    }
}
