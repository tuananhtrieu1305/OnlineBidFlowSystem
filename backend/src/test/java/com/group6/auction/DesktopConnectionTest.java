package com.group6.auction;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration"
})
class DesktopConnectionTest {
    @LocalServerPort
    private int port;

    @Test
    void healthAllowsPackagedDesktopAndRejectsUntrustedOrigin() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var allowed = client.send(healthRequest("app://auction"), HttpResponse.BodyHandlers.ofString());
            assertThat(allowed.statusCode()).isEqualTo(200);
            assertThat(allowed.headers().firstValue("Access-Control-Allow-Origin")).contains("app://auction");
            assertThat(allowed.body()).contains("\"status\":\"UP\"");
            var rejected = client.send(healthRequest("https://untrusted.example"), HttpResponse.BodyHandlers.ofString());
            assertThat(rejected.statusCode()).isEqualTo(403);
        }
    }

    @Test
    void websocketRespondsToPingForDesktopAndDevOrigins() throws Exception {
        for (String origin : new String[]{"app://auction", "http://localhost:5173"}) {
            try (var client = HttpClient.newHttpClient()) {
                var message = new CompletableFuture<String>();
                var socket = client.newWebSocketBuilder().header("Origin", origin)
                        .buildAsync(URI.create("ws://localhost:" + port + "/ws/health"), new WebSocket.Listener() {
                            private final StringBuilder buffer = new StringBuilder();
                            @Override
                            public CompletionStage<?> onText(WebSocket ws, CharSequence text, boolean last) {
                                buffer.append(text);
                                if (last) message.complete(buffer.toString());
                                ws.request(1);
                                return null;
                            }
                        }).get(5, TimeUnit.SECONDS);
                try {
                    socket.sendText("PING", true).get(5, TimeUnit.SECONDS);
                    assertThat(message.get(5, TimeUnit.SECONDS)).isEqualTo("PONG");
                } finally {
                    socket.abort();
                }
            }
        }
    }

    @Test
    void websocketRejectsUntrustedOrigin() {
        try (var client = HttpClient.newHttpClient()) {
            assertThatThrownBy(() -> client.newWebSocketBuilder()
                    .header("Origin", "https://untrusted.example")
                    .buildAsync(URI.create("ws://localhost:" + port + "/ws/health"), new WebSocket.Listener() {})
                    .get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(WebSocketHandshakeException.class);
        }
    }

    private HttpRequest healthRequest(String origin) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
                .header("Origin", origin).GET().build();
    }
}
