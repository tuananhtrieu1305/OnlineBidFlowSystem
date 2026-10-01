package com.group6.auction;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimePersistenceIT {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    String username = "rt_" + UUID.randomUUID().toString().replace("-", "");
    String cookie = "", csrf = "";
    Long productId, auctionId, userId;
    @BeforeAll static void isolatedOnly() {
        if (!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE"))) throw new IllegalStateException("Isolated DB required");
    }
    @AfterEach void clean() {
        if (auctionId != null) {
            jdbc.update("DELETE FROM chat_messages WHERE auction_id=?", auctionId);
            jdbc.update("DELETE FROM auction_participants WHERE auction_id=?", auctionId);
            jdbc.update("DELETE FROM auctions WHERE id=?", auctionId);
        }
        if (productId != null) jdbc.update("DELETE FROM products WHERE id=?", productId);
        jdbc.update("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE username=?)", username);
        jdbc.update("DELETE FROM users WHERE username=?", username);
    }
    HttpResponse<String> request(String method, String route, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + route))
            .header("Content-Type", "application/json");
        if (!cookie.isEmpty()) builder.header("Cookie", cookie);
        if (!csrf.isEmpty()) builder.header("X-CSRF-TOKEN", csrf);
        try (var client = HttpClient.newHttpClient()) {
            var response = client.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            response.headers().firstValue("set-cookie").ifPresent(c -> cookie = c.split(";")[0]);
            return response;
        }
    }
    @Test void sessionCanJoinChatReconnectAndReplayWithoutExposingBlindPrices() throws Exception {
        String credentials = "{\"username\":\"" + username + "\",\"password\":\"test-password-123\"}";
        assertThat(request("POST", "/api/auth/register", credentials).statusCode()).isEqualTo(201);
        csrf = json.readTree(request("GET", "/api/auth/csrf", null).body()).get("token").asText();
        assertThat(request("POST", "/api/auth/login", credentials).statusCode()).isEqualTo(200);
        userId = jdbc.queryForObject("SELECT id FROM users WHERE username=?", Long.class, username);
        jdbc.update("INSERT INTO products(name,quantity,estimated_price) VALUES (?,1,77777)", username);
        productId = jdbc.queryForObject("SELECT id FROM products WHERE name=?", Long.class, username);
        jdbc.update("INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,start_time,end_time,status) VALUES (?,?,'BLIND','PUBLIC',88888,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),'RUNNING')", productId, userId);
        auctionId = jdbc.queryForObject("SELECT id FROM auctions WHERE product_id=?", Long.class, productId);
        try (var client = HttpClient.newHttpClient()) {
            for (int attempt = 0; attempt < 2; attempt++) {
                var messages = new LinkedBlockingQueue<String>();
                var socket = client.newWebSocketBuilder().header("Cookie", cookie).header("Origin", "app://auction")
                    .buildAsync(URI.create("ws://localhost:" + port + "/ws/auction"), new WebSocket.Listener() {
                        final StringBuilder buffer = new StringBuilder();
                        public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                            buffer.append(data);
                            if (last) { messages.add(buffer.toString()); buffer.setLength(0); }
                            ws.request(1); return null;
                        }
                    }).get(5, TimeUnit.SECONDS);
                try {
                    socket.sendText("{\"type\":\"JOIN_ROOM\",\"payload\":{\"auctionId\":" + auctionId + "}}", true).join();
                    String state = null;
                    for (int i = 0; i < 4; i++) {
                        String event = messages.poll(5, TimeUnit.SECONDS);
                        assertThat(event).isNotNull();
                        if (event.contains("\"type\":\"AUCTION_STATE\"")) { state = event; break; }
                    }
                    assertThat(state).contains("BLIND").doesNotContain("startingPrice", "estimatedPrice", "88888", "77777");
                    if (attempt == 0) {
                        socket.sendText("{\"type\":\"SEND_CHAT_MESSAGE\",\"payload\":{\"auctionId\":" + auctionId + ",\"content\":\"integration hello\"}}", true).join();
                        String chat = messages.poll(5, TimeUnit.SECONDS);
                        assertThat(chat).contains("integration hello", username);
                    } else assertThat(state).contains("integration hello");
                } finally { socket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join(); }
            }
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=? AND user_id=?", Integer.class, auctionId, userId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM chat_messages WHERE auction_id=?", Integer.class, auctionId)).isEqualTo(1);
        jdbc.update("UPDATE auctions SET status='UNSOLD',finished_at=UTC_TIMESTAMP(6) WHERE id=?", auctionId);
        var replay = request("GET", "/api/auctions/" + auctionId + "/replay", null);
        assertThat(replay.statusCode()).isEqualTo(200);
        assertThat(replay.body()).contains("integration hello", "\"viewerRole\":\"USER\"").doesNotContain("88888", "77777");
    }
}
