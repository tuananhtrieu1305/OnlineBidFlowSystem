package com.group6.auction;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.mock.web.MockHttpSession;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import com.group6.auction.auction.lifecycle.AuctionStartService;
import com.group6.auction.wallet.service.WalletException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import com.group6.auction.auction.normal.NormalException;
import com.group6.auction.auction.normal.NormalService;
import com.group6.auction.auction.normal.NormalRepository;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:normal;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "app.normal.scheduler-enabled=false", "app.login.attempts-per-minute=1000"
})
@AutoConfigureMockMvc
class NormalApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired NormalService service;
    @Autowired PasswordEncoder encoder;
    @Autowired ObjectMapper json;
    @Autowired AuctionStartService starter;
    private final java.util.Map<String, MockHttpSession> sessions = new java.util.HashMap<>();
    private final java.util.Map<String, String> tokens = new java.util.HashMap<>();
    @SpyBean NormalRepository repository;
    @SpyBean com.group6.auction.auction.integration.AuctionWalletIntegration integration;

    @BeforeEach
    void seed() throws Exception {
        sessions.clear(); tokens.clear(); reset(repository, integration);
        // Exercise the actual project schema/seed with only MySQL syntax adapted for H2.
        String sql = Files.readString(Path.of("../database/init.sql"))
                .replaceAll("(?m)^--.*$", "")
                .replaceAll("(?s)CREATE DATABASE.*?;", "")
                .replaceAll("(?m)^(USE|SET) .*?;", "")
                .replace(" UNSIGNED", "")
                .replace(" ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci", "");
        for (String statement : sql.split(";")) if (!statement.isBlank()) jdbc.execute(statement);
        // Complete only the isolated test ledger; production seed is intentionally left untouched.
        jdbc.update("UPDATE users SET password_hash = ?", encoder.encode("Password@123"));
        jdbc.update("INSERT INTO coin_transactions(wallet_id,auction_id,transaction_type,available_delta,locked_delta,created_at) VALUES (2,5,'LOCK',-2500,2500,CURRENT_TIMESTAMP)");
    }
    private MockHttpSession auth(String user) throws Exception {
        if (sessions.containsKey(user)) return sessions.get(user);
        var csrf = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) csrf.getRequest().getSession();
        String token = json.readTree(csrf.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(post("/api/auth/login").session(session).header("X-CSRF-TOKEN", token)
                .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("username", user, "password", "Password@123"))))
                .andExpect(status().isOk());
        var fresh = mvc.perform(get("/api/auth/csrf").session(session)).andExpect(status().isOk()).andReturn();
        sessions.put(user, session);
        tokens.put(user, json.readTree(fresh.getResponse().getContentAsString()).get("token").asText());
        return session;
    }
    private String csrf(String user) throws Exception { auth(user); return tokens.get(user); }
    private long value(String sql) { return jdbc.queryForObject(sql, Long.class); }
    private long total() { return value("SELECT SUM(available_balance + locked_balance) FROM wallets"); }
    private long transactions() { return value("SELECT COUNT(*) FROM coin_transactions"); }

    @Test
    void authVisibilityAndPrivateAccess() throws Exception {
        assertThat(encoder.matches("Password@123", jdbc.queryForObject("SELECT password_hash FROM users WHERE id = 2", String.class))).isTrue();
        mvc.perform(get("/api/normal/auctions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/normal/me").header("Authorization", "Basic " + Base64.getEncoder().encodeToString("alice:wrong".getBytes())))
                .andExpect(status().isUnauthorized());
        var response = mvc.perform(get("/api/normal/auctions").session(auth("alice")).header("X-CSRF-TOKEN", csrf("alice")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("estimatedPrice", "estimated_price", "roomCode", "KEYROOM", "CAMERA26", "BLIND");
        mvc.perform(get("/api/normal/auctions/3").session(auth("alice")).header("X-CSRF-TOKEN", csrf("alice"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/normal/auctions/5").session(auth("bob")).header("X-CSRF-TOKEN", csrf("bob"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/normal/auctions/5/join").session(auth("bob")).header("X-CSRF-TOKEN", csrf("bob")).contentType("application/json").content("{\"roomCode\":\"wrong\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/normal/auctions/5/join").session(auth("bob")).header("X-CSRF-TOKEN", csrf("bob")).contentType("application/json").content("{\"roomCode\":\"KEYROOM\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.joined").value(true));
        mvc.perform(get("/api/normal/auctions/5/bids").session(auth("bob")).header("X-CSRF-TOKEN", csrf("bob"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
    }
    @Test
    void sharedSessionRequiresCsrfAndRejectsInconsistentLedgerWithoutSavingBid() throws Exception {
        mvc.perform(post("/api/normal/auctions/5/bids").session(auth("alice"))
                .contentType("application/json").content("{\"amount\":2650}"))
                .andExpect(status().isForbidden());
        jdbc.update("DELETE FROM coin_transactions WHERE wallet_id=2 AND auction_id=5");
        long transactions = transactions();
        mvc.perform(post("/api/normal/auctions/5/bids").session(auth("alice")).header("X-CSRF-TOKEN", csrf("alice"))
                .contentType("application/json").content("{\"amount\":2650}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WALLET_LEDGER_INCONSISTENT"));
        assertThat(value("SELECT COUNT(*) FROM bids WHERE auction_id=5")).isEqualTo(3);
        assertThat(transactions()).isEqualTo(transactions);
        assertThat(value("SELECT available_balance FROM wallets WHERE user_id=2")).isEqualTo(4400);
    }
    @Test
    void rejectsInvalidAmountsWithoutMutatingDatabase() throws Exception {
        long transactions = transactions();
        for (String amount : new String[]{"null", "0", "-1", "2650.5", "9007199254740992"}) {
            mvc.perform(post("/api/normal/auctions/5/bids").session(auth("alice")).header("X-CSRF-TOKEN", csrf("alice")).contentType("application/json").content("{\"amount\":" + amount + "}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/normal/auctions/5/bids").session(auth("alice")).header("X-CSRF-TOKEN", csrf("alice")).contentType("application/json").content("{\"amount\":2500}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BID_TOO_LOW"));
        assertThat(transactions()).isEqualTo(transactions);
        assertThat(value("SELECT COUNT(*) FROM bids WHERE auction_id = 5")).isEqualTo(3);
    }
    @Test
    void selfRaiseLocksOnlyDifferenceAndOutbidUnlocksPreviousLeader() throws Exception {
        long total = total();
        mvc.perform(post("/api/normal/auctions/5/bids").session(auth("alice")).header("X-CSRF-TOKEN", csrf("alice")).contentType("application/json").content("{\"amount\":2650}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.wallet.availableBalance").value("4250")).andExpect(jsonPath("$.wallet.lockedBalance").value("4250"));
        service.bid(5, "fiona", 2800);
        assertThat(value("SELECT available_balance FROM wallets WHERE user_id = 2")).isEqualTo(6900);
        assertThat(value("SELECT locked_balance FROM wallets WHERE user_id = 2")).isEqualTo(1600); // BLIND lock remains untouched.
        assertThat(value("SELECT locked_balance FROM wallets WHERE user_id = 7")).isEqualTo(2800);
        assertThat(total()).isEqualTo(total);
        assertThat(value("SELECT SUM(locked_delta) FROM coin_transactions WHERE auction_id = 5 AND transaction_type = 'LOCK' AND wallet_id = 2")).isEqualTo(2650);
    }
    @Test
    void insufficientWalletRollsBackAndUnjoinedAdminAndClosedAuctionsCannotBid() {
        long total = total(), transactions = transactions();
        assertThatThrownBy(() -> service.bid(5, "alice", 7000)).isInstanceOf(WalletException.class).hasMessage("INSUFFICIENT_COIN");
        assertThatThrownBy(() -> service.bid(5, "bob", 2700)).isInstanceOf(NormalException.class);
        assertThatThrownBy(() -> service.bid(5, "admin", 2700)).isInstanceOf(NormalException.class);
        assertThatThrownBy(() -> service.bid(1, "alice", 1700)).isInstanceOf(NormalException.class);
        assertThatThrownBy(() -> service.bid(6, "alice", 1700)).isInstanceOf(NormalException.class);
        assertThat(transactions()).isEqualTo(transactions);
        assertThat(total()).isEqualTo(total);
    }
    @Test
    void databaseFailureAfterWalletUpdatesRollsBackBalancesAndAudit() {
        long total = total(), transactions = transactions();
        com.group6.auction.auction.integration.AuctionWalletIntegration target = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(integration);
        doAnswer(call -> { call.callRealMethod(); throw new DataIntegrityViolationException("simulated failure after wallet transfer"); })
                .when(target).normalBidAccepted(anyLong(), anyLong(), any(), anyLong());
        assertThatThrownBy(() -> service.bid(5, "fiona", 2700)).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(value("SELECT available_balance FROM wallets WHERE user_id = 2")).isEqualTo(4400);
        assertThat(value("SELECT locked_balance FROM wallets WHERE user_id = 2")).isEqualTo(4100);
        assertThat(value("SELECT locked_balance FROM wallets WHERE user_id = 7")).isZero();
        assertThat(value("SELECT COUNT(*) FROM bids WHERE auction_id = 5")).isEqualTo(3);
        assertThat(transactions()).isEqualTo(transactions);
        assertThat(total()).isEqualTo(total);
    }
    @Test
    void concurrentBidsAcceptOnlyOneAtSamePrice() throws Exception {
        service.join(5, "bob", "KEYROOM");
        long total = total();
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var futures = java.util.stream.Stream.of("bob", "fiona").map(user -> pool.submit(() -> {
                start.await();
                try { service.bid(5, user, 2700); return true; }
                catch (NormalException error) { assertThat(error.code()).isEqualTo("BID_TOO_LOW"); return false; }
            })).toList();
            start.countDown();
            int accepted = 0;
            for (var future : futures) if (future.get(15, TimeUnit.SECONDS)) accepted++;
            assertThat(accepted).isEqualTo(1);
        }
        assertThat(value("SELECT COUNT(*) FROM bids WHERE auction_id = 5")).isEqualTo(4);
        assertThat(total()).isEqualTo(total);
    }
    @Test
    void endingIsIdempotentAndPreservesLocksFromOtherAuctions() {
        long total = total();
        jdbc.update("UPDATE auctions SET end_time = ? WHERE id = 5", LocalDateTime.ofInstant(Instant.now().minusSeconds(1), ZoneOffset.UTC));
        service.advance(5);
        service.advance(5);
        assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id = 5", String.class)).isEqualTo("SOLD");
        assertThat(value("SELECT winner_user_id FROM auctions WHERE id = 5")).isEqualTo(2);
        assertThat(value("SELECT available_balance FROM wallets WHERE wallet_type = 'SYSTEM'")).isEqualTo(4000);
        assertThat(value("SELECT locked_balance FROM wallets WHERE user_id = 2")).isEqualTo(1600);
        assertThat(value("SELECT COUNT(*) FROM coin_transactions WHERE auction_id = 5 AND transaction_type = 'PAYMENT'")).isEqualTo(2);
        assertThat(total()).isEqualTo(total);
    }
    @Test
    void lifecycleStartsUpcomingAndEndsNoBidAuctionUnsold() {
        jdbc.update("UPDATE auctions SET start_time = ?, end_time = ? WHERE id = 6", LocalDateTime.ofInstant(Instant.now().minusSeconds(30), ZoneOffset.UTC), LocalDateTime.ofInstant(Instant.now().plusSeconds(30), ZoneOffset.UTC));
        starter.startDue(LocalDateTime.now(ZoneOffset.UTC));
        assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id = 6", String.class)).isEqualTo("RUNNING");
        jdbc.update("UPDATE auctions SET end_time = ? WHERE id = 6", LocalDateTime.ofInstant(Instant.now().minusSeconds(1), ZoneOffset.UTC));
        service.advance(6);
        assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id = 6", String.class)).isEqualTo("UNSOLD");
        assertThat(jdbc.queryForObject("SELECT winner_user_id FROM auctions WHERE id = 6", Long.class)).isNull();
    }
    @Test
    void roomCapacityAndParticipationBalanceAreEnforcedAndJoinIsIdempotent() {
        long transactions = transactions();
        assertThatThrownBy(() -> service.join(5, "alice", "wrong")).isInstanceOf(NormalException.class).hasMessageContaining("invalid");
        service.join(5, "alice", "KEYROOM");
        assertThat(value("SELECT COUNT(*) FROM auction_participants WHERE auction_id = 5")).isEqualTo(2);
        jdbc.update("UPDATE auctions SET max_participants = 2 WHERE id = 5");
        assertThatThrownBy(() -> service.join(5, "bob", "KEYROOM")).isInstanceOf(NormalException.class).hasMessageContaining("full");
        jdbc.update("UPDATE auctions SET max_participants = 6 WHERE id = 5");
        jdbc.update("UPDATE wallets SET available_balance = 999 WHERE user_id = 3");
        assertThatThrownBy(() -> service.join(5, "bob", "KEYROOM")).isInstanceOf(NormalException.class).hasMessageContaining("50%");
        assertThat(value("SELECT COUNT(*) FROM auction_participants WHERE auction_id = 5")).isEqualTo(2);
        assertThat(transactions()).isEqualTo(transactions);
    }
}
