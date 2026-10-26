package com.group6.auction.leaderboard;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.auctions.auto-start=false")
@AutoConfigureMockMvc
@Transactional
class LeaderboardIT {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean Clock clock;

    @BeforeAll static void isolatedDatabase() {
        if (!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))
            throw new IllegalStateException("Isolated MySQL required");
    }

    private void time(String instant) { when(clock.instant()).thenReturn(Instant.parse(instant)); }
    private MockHttpSession session(String username, String role) {
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
            new SecurityContextImpl(new UsernamePasswordAuthenticationToken(username, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)))));
        return session;
    }
    private long user(String suffix) {
        String name = "rank_" + UUID.randomUUID().toString().substring(0, 8) + suffix;
        jdbc.update("INSERT INTO users(username,password_hash,role) VALUES (?,'unused','USER')", name);
        return jdbc.queryForObject("SELECT id FROM users WHERE username=?", Long.class, name);
    }
    private String username(long id) {
        return jdbc.queryForObject("SELECT username FROM users WHERE id=?", String.class, id);
    }
    private long product() {
        String name = "rank_product_" + UUID.randomUUID();
        jdbc.update("INSERT INTO products(name,quantity) VALUES (?,1)", name);
        return jdbc.queryForObject("SELECT id FROM products WHERE name=?", Long.class, name);
    }
    private long auction(long product, String type, String access, String status, Long winner,
                         Long price, String finished, boolean startedBlind, long... participants) {
        LocalDateTime end = LocalDateTime.ofInstant(Instant.parse(finished), ZoneOffset.UTC);
        LocalDateTime start = end.minusHours(2);
        jdbc.update("""
            INSERT INTO auctions(product_id,created_by,auction_type,access_type,room_code,starting_price,
                min_bid_increment,start_time,end_time,finished_at,status,winner_user_id,winning_price)
            VALUES (?,1,?,?,?,100,?,?,?,?,?,?,?)
            """, product, type, access, "PRIVATE".equals(access) ? "RANKROOM" : null,
            "NORMAL".equals(type) ? 10 : null, start, end,
            end, status, winner, price);
        long id = jdbc.queryForObject("SELECT MAX(id) FROM auctions WHERE product_id=?", Long.class, product);
        for (long participant : participants)
            jdbc.update("INSERT INTO auction_participants(auction_id,user_id,joined_at) VALUES (?,?,?)", id, participant, start);
        if (startedBlind)
            jdbc.update("INSERT INTO blind_rounds(auction_id,started_at,trade_ends_at,bid_locks_at,ends_at) VALUES (?,?,?,?,?)",
                id, start, start.plusMinutes(5), start.plusMinutes(7), end);
        return id;
    }

    @Test void publicRanksUseWinsThenWinRateAndExcludeUnstartedBlindAndPrivateResults() throws Exception {
        time("2026-10-26T00:00:00Z");
        long product = product(), a = user("a"), b = user("b"), c = user("c"), d = user("d");
        auction(product, "NORMAL", "PUBLIC", "SOLD", a, 400L, "2026-10-10T10:00:00Z", false, a, b);
        auction(product, "NORMAL", "PUBLIC", "SOLD", b, 500L, "2026-10-11T10:00:00Z", false, a, b);
        auction(product, "BLIND", "PUBLIC", "SOLD", a, 600L, "2026-10-12T10:00:00Z", true, a, b, c);
        auction(product, "BLIND", "PUBLIC", "UNSOLD", null, null, "2026-10-13T10:00:00Z", true, a, b, c);
        auction(product, "BLIND", "PUBLIC", "UNSOLD", null, null, "2026-10-14T10:00:00Z", false, a, b, c);
        auction(product, "BLIND", "PRIVATE", "SOLD", c, 700L, "2026-10-15T10:00:00Z", true, a, c);
        auction(product, "NORMAL", "PUBLIC", "SOLD", b, 800L, "2026-10-16T10:00:00Z", false, b, d);

        String path = "/api/leaderboard";
        JsonNode board = json.readTree(mvc.perform(get(path).param("period", "MONTH")).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalPlayers").value(4)).andReturn().getResponse().getContentAsString());
        assertThat(board.get("top").get(0).get("username").asText()).isEqualTo(username(a));
        assertThat(board.get("top").get(0).get("wins").asLong()).isEqualTo(2);
        assertThat(board.get("top").get(0).get("played").asLong()).isEqualTo(4);
        assertThat(board.get("top").get(0).get("rank").asLong()).isEqualTo(1);
        assertThat(board.get("top").get(1).get("username").asText()).isEqualTo(username(b));
        assertThat(board.get("top").get(1).get("wins").asLong()).isEqualTo(2);
        assertThat(board.get("top").get(1).get("played").asLong()).isEqualTo(5);
        assertThat(board.get("top").get(1).get("rank").asLong()).isEqualTo(2);
        assertThat(board.get("top").get(2).get("rank").asLong()).isEqualTo(3);
        assertThat(board.get("top").get(3).get("rank").asLong()).isEqualTo(3);
        assertThat(board.toString()).doesNotContain("RANKROOM", "700", "winningPrice", "startingPrice");

        JsonNode blind = json.readTree(mvc.perform(get(path).param("type", "BLIND").param("period", "MONTH"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(blind.get("top").get(0).get("wins").asLong()).isEqualTo(1);
        assertThat(blind.get("top").get(0).get("played").asLong()).isEqualTo(2);
        mvc.perform(get(path).param("type", "NORMAL")).andExpect(status().isBadRequest());
        mvc.perform(get(path).param("period", "WEEK")).andExpect(status().isBadRequest());

        String minePath = "/api/leaderboard/me";
        mvc.perform(get(minePath)).andExpect(status().isUnauthorized());
        mvc.perform(get(minePath).session(session("admin", "ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get(minePath).param("period", "MONTH").session(session(username(c), "USER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.publicRank.rank").value(3))
            .andExpect(jsonPath("$.publicRank.played").value(2))
            .andExpect(jsonPath("$.privateStats.played").value(1))
            .andExpect(jsonPath("$.privateStats.wins").value(1))
            .andExpect(jsonPath("$.privateStats.coinSpent").value("700"))
            .andExpect(jsonPath("$.allStats.played").value(3))
            .andExpect(jsonPath("$.allStats.coinSpent").value("700"));
    }

    @Test void monthUsesVietnamCalendarBoundaryAndKeepsEmptyState() throws Exception {
        time("2026-10-26T00:00:00Z");
        long product = product(), user = user("m");
        auction(product, "NORMAL", "PUBLIC", "SOLD", user, 100L, "2026-09-30T16:59:59Z", false, user);
        auction(product, "NORMAL", "PUBLIC", "SOLD", user, 200L, "2026-09-30T17:00:00Z", false, user);
        mvc.perform(get("/api/leaderboard").param("period", "MONTH"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.month").value("2026-10"))
            .andExpect(jsonPath("$.totalPlayers").value(1))
            .andExpect(jsonPath("$.top[0].wins").value(1))
            .andExpect(jsonPath("$.top[0].played").value(1));
        mvc.perform(get("/api/leaderboard").param("type", "BLIND").param("period", "MONTH"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.top.length()").value(0));
    }
}
