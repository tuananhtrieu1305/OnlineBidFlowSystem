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
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.login.attempts-per-minute=100")
class LoginIT {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    String username = "login_" + UUID.randomUUID().toString().replace("-", "");
    String cookie = "";
    String csrf = "";

    @BeforeAll static void isolatedOnly() {
        if (!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE"))) throw new IllegalStateException("Isolated database required");
    }
    @BeforeEach void createAccount() throws Exception {
        assertThat(request("POST", "/api/auth/register", body("my-password-123")).statusCode()).isEqualTo(201);
    }
    @AfterEach void clean() {
        jdbc.update("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE username=?)", username);
        jdbc.update("DELETE FROM users WHERE username=?", username);
    }
    String body(String password) { return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"; }
    HttpResponse<String> request(String method, String route, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + route))
            .header("Origin", "app://auction").header("Content-Type", "application/json");
        if (!cookie.isEmpty()) builder.header("Cookie", cookie);
        if (!csrf.isEmpty()) builder.header("X-CSRF-TOKEN", csrf);
        try (var client = HttpClient.newHttpClient()) {
            var result = client.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            result.headers().firstValue("set-cookie").ifPresent(value -> cookie = value.split(";")[0]);
            return result;
        }
    }
    void bootstrap() throws Exception {
        var result = request("GET", "/api/auth/csrf", null);
        assertThat(result.statusCode()).isEqualTo(200);
        csrf = json.readTree(result.body()).get("token").asText();
    }
    @Test void loginRotatesSessionRestoresIdentityAndLogoutRevokesIt() throws Exception {
        assertThat(request("GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        bootstrap();
        String anonymousCookie = cookie;
        var login = request("POST", "/api/auth/login", body("my-password-123").replace(username, "  " + username.toUpperCase() + " "));
        assertThat(login.statusCode()).isEqualTo(200);
        assertThat(login.body()).contains(username, "\"role\":\"USER\"").doesNotContain("password", "hash");
        assertThat(login.headers().firstValue("set-cookie").orElseThrow()).contains("HttpOnly", "Secure", "SameSite=None");
        assertThat(cookie).isNotEqualTo(anonymousCookie);
        String authenticatedCookie = cookie;
        assertThat(request("GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
        cookie = anonymousCookie;
        assertThat(request("GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        cookie = authenticatedCookie;
        csrf = "";
        assertThat(request("POST", "/api/auth/logout", "{}").statusCode()).isEqualTo(403);
        bootstrap();
        assertThat(request("POST", "/api/auth/logout", "{}").statusCode()).isEqualTo(204);
        cookie = authenticatedCookie;
        assertThat(request("GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
    }
    @Test void rejectsWrongCredentialsAndMissingCsrfWithoutLeakingAccountExistence() throws Exception {
        assertThat(request("POST", "/api/auth/login", body("my-password-123")).statusCode()).isEqualTo(403);
        bootstrap();
        var wrong = request("POST", "/api/auth/login", body("incorrect"));
        assertThat(wrong.statusCode()).isEqualTo(401);
        var missing = request("POST", "/api/auth/login", body("incorrect").replace(username, "missing_account"));
        assertThat(missing.statusCode()).isEqualTo(401);
        assertThat(missing.body()).isEqualTo(wrong.body());
        assertThat(request("GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        assertThat(request("POST", "/api/auth/login", body("my-password-123").replace("}", ",\"role\":\"ADMIN\"}")).statusCode()).isEqualTo(400);
    }
    @Test void usesServerRoleAndProtectsAdminRoutes() throws Exception {
        bootstrap();
        assertThat(request("POST", "/api/auth/login", body("my-password-123")).statusCode()).isEqualTo(200);
        assertThat(request("GET", "/api/admin/session", null).statusCode()).isEqualTo(403);
        jdbc.update("UPDATE users SET role='ADMIN' WHERE username=?", username);
        bootstrap();
        assertThat(request("POST", "/api/auth/login", body("my-password-123")).body()).contains("\"role\":\"ADMIN\"");
        assertThat(request("GET", "/api/admin/session", null).statusCode()).isEqualTo(200);
    }
}
