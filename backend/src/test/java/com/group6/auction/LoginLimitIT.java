package com.group6.auction;

import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.login.attempts-per-minute=2")
class LoginLimitIT {
    @LocalServerPort int port;
    @BeforeAll static void isolatedOnly() {
        if (!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE"))) throw new IllegalStateException("Isolated database required");
    }
    @Test void throttlesLoginAndRejectsUntrustedOrigins() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            String base = "http://localhost:" + port;
            var bootstrap = client.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/csrf")).GET().build(), HttpResponse.BodyHandlers.ofString());
            String cookie = bootstrap.headers().firstValue("set-cookie").orElseThrow().split(";")[0];
            String csrf = new ObjectMapper().readTree(bootstrap.body()).get("token").asText();
            var login = HttpRequest.newBuilder(URI.create(base + "/api/auth/login"))
                .header("Content-Type", "application/json").header("Cookie", cookie).header("X-CSRF-TOKEN", csrf)
                .POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"missing_limit_user\",\"password\":\"wrong\"}")).build();
            assertThat(client.send(login, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
            assertThat(client.send(login, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
            var blocked = client.send(login, HttpResponse.BodyHandlers.ofString());
            assertThat(blocked.statusCode()).isEqualTo(429);
            assertThat(blocked.headers().firstValue("Retry-After")).contains("60");
            var origin = client.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/csrf")).header("Origin", "https://untrusted.example").GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(origin.statusCode()).isEqualTo(403);
        }
    }
}
