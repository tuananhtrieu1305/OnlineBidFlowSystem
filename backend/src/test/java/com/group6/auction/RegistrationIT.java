package com.group6.auction;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import java.net.URI;
import java.net.http.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.group6.auction.wallet.service.WalletService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterEach;
import java.util.UUID;
import java.util.concurrent.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.registration.attempts-per-minute=1000")
class RegistrationIT {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @SpyBean WalletService wallets;
    private final String username = "regtest_" + UUID.randomUUID().toString().replace("-", "");

    @BeforeAll
    static void requireIsolatedDatabase() {
        if (!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE"))) {
            throw new IllegalStateException("Run registration IT only on an isolated database; set REGISTRATION_TEST_DATABASE=true after provisioning it.");
        }
    }

    @AfterEach
    void cleanOwnAccount() {
        reset(wallets);
        jdbc.update("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE username=?)", username);
        jdbc.update("DELETE FROM users WHERE username=?", username);
    }

    HttpResponse<String> post(String body) throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/register"))
                .header("Content-Type", "application/json").header("Origin", "app://auction")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        }
    }
    String validBody() { return "{\"username\":\"" + username + "\",\"password\":\"my-password-123\"}"; }

    @Test
    void createsUserWithHashedPasswordAndExactlyOneEmptyWallet() throws Exception {
        var result = post(validBody());
        assertThat(result.statusCode()).isEqualTo(201);
        assertThat(result.body()).contains("\"role\":\"USER\"").doesNotContain("password", "hash");
        assertThat(result.headers().firstValue("Access-Control-Allow-Origin")).contains("app://auction");
        var user = jdbc.queryForMap("SELECT id, password_hash, role FROM users WHERE username=?", username);
        assertThat(encoder.matches("my-password-123", (String) user.get("password_hash"))).isTrue();
        var wallet = jdbc.queryForMap("SELECT wallet_type, available_balance, locked_balance, updated_at FROM wallets WHERE user_id=?", user.get("id"));
        assertThat(wallet.get("wallet_type")).isEqualTo("USER");
        assertThat(((Number) wallet.get("available_balance")).longValue()).isZero();
        assertThat(((Number) wallet.get("locked_balance")).longValue()).isZero();
        assertThat(wallet.get("updated_at")).isNotNull();
        assertThat(post(validBody().replace(username, "  " + username.toUpperCase() + "  ")).statusCode()).isEqualTo(409);
    }

    @Test
    void rejectsPrivilegeInjectionAndMalformedJson() throws Exception {
        assertThat(post(validBody().replace("}", ",\"role\":\"ADMIN\"}")).statusCode()).isEqualTo(400);
        assertThat(post("{not json").statusCode()).isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE username=?", Integer.class, username)).isZero();
    }

    @Test
    void rollsBackUserWhenWalletCreationFails() throws Exception {
        doThrow(new IllegalStateException("internal test failure")).when(wallets).createUserWallet(anyLong());
        var result = post(validBody());
        assertThat(result.statusCode()).isEqualTo(500);
        assertThat(result.body()).doesNotContain("internal test failure", "password", "stackTrace");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE username=?", Integer.class, username)).isZero();
    }

    @Test
    void concurrentRequestsCreateOnlyOneAccountAndWallet() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var gate = new CountDownLatch(1);
            Callable<Integer> request = () -> { gate.await(); return post(validBody()).statusCode(); };
            var a = executor.submit(request);
            var b = executor.submit(request);
            gate.countDown();
            assertThat(java.util.List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 409);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM wallets w JOIN users u ON w.user_id=u.id WHERE u.username=?", Integer.class, username)).isEqualTo(1);
        }
    }

    @Test
    void rejectsInvalidRegistrationWithoutCreatingAnAccount() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/register"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"x\",\"password\":\"short\"}"))
                .build();
        try (var client = HttpClient.newHttpClient()) {
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(400);
            assertThat(response.body()).contains("VALIDATION_ERROR").doesNotContain("short");
        }
    }
}
