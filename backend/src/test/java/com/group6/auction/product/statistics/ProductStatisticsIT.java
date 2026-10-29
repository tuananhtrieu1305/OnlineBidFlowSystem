package com.group6.auction.product.statistics;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.auctions.auto-start=false")
@AutoConfigureMockMvc
@Transactional
class ProductStatisticsIT {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeAll static void isolatedDatabase() {
        if (!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))
            throw new IllegalStateException("Isolated MySQL required");
    }

    private MockHttpSession session(String role) {
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
            new SecurityContextImpl(new UsernamePasswordAuthenticationToken("statistics-test", null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)))));
        return session;
    }

    private long product() {
        String name = "stats_" + UUID.randomUUID();
        jdbc.update("INSERT INTO products(name,quantity,estimated_price) VALUES (?,1,300)", name);
        return jdbc.queryForObject("SELECT id FROM products WHERE name=?", Long.class, name);
    }

    private void auction(long productId, String type, String status, Long winningPrice, int day) {
        LocalDateTime start = LocalDateTime.of(2030, 1, 1, 0, 0).plusDays(day);
        jdbc.update("""
            INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,
                                 min_bid_increment,start_time,end_time,finished_at,status,winner_user_id,winning_price)
            VALUES (?,1,?,'PUBLIC',100,?,?,?, ?, ?, ?, ?)
            """, productId, type, "NORMAL".equals(type) ? 10 : null, start,
            start.plusHours(1), "SOLD".equals(status) || "UNSOLD".equals(status) ? start.plusHours(1) : null,
            status, "SOLD".equals(status) ? 2 : null, winningPrice);
    }

    @Test void aggregatesFinishedAuctionsAndKeepsInternalDataAdminOnly() throws Exception {
        long id = product();
        auction(id, "NORMAL", "SOLD", 100L, 0);
        auction(id, "NORMAL", "SOLD", 200L, 1);
        auction(id, "NORMAL", "SOLD", 300L, 2);
        auction(id, "BLIND", "SOLD", 400L, 3);
        auction(id, "BLIND", "SOLD", 1000L, 4);
        auction(id, "NORMAL", "UNSOLD", null, 5);
        auction(id, "NORMAL", "RUNNING", null, 6);
        auction(id, "BLIND", "UPCOMING", null, 7);

        String path = "/api/admin/products/" + id + "/statistics";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).session(session("USER"))).andExpect(status().isForbidden());
        var body = mvc.perform(get(path).session(session("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.counts.total").value(8))
            .andExpect(jsonPath("$.counts.sold").value(5))
            .andExpect(jsonPath("$.counts.unsold").value(1))
            .andExpect(jsonPath("$.counts.upcoming").value(1))
            .andExpect(jsonPath("$.counts.running").value(1))
            .andExpect(jsonPath("$.prices.average").value("400"))
            .andExpect(jsonPath("$.prices.median").value("300"))
            .andExpect(jsonPath("$.prices.minimum").value("100"))
            .andExpect(jsonPath("$.prices.maximum").value("1000"))
            .andExpect(jsonPath("$.prices.latest").value("1000"))
            .andExpect(jsonPath("$.byType[0].averagePrice").value("200"))
            .andExpect(jsonPath("$.byType[1].averagePrice").value("700"))
            .andExpect(jsonPath("$.trend.length()").value(5))
            .andExpect(jsonPath("$.history.totalElements").value(6))
            .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("estimatedPrice", "startingPrice", "winnerUserId");
    }

    @Test void emptyAndPaginatedHistoryHaveStableBoundaries() throws Exception {
        long empty = product();
        String emptyPath = "/api/admin/products/" + empty + "/statistics";
        mvc.perform(get(emptyPath).session(session("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.counts.total").value(0))
            .andExpect(jsonPath("$.prices.soldCount").value(0))
            .andExpect(jsonPath("$.prices.median").isEmpty())
            .andExpect(jsonPath("$.history.items.length()").value(0));
        for (int day = 0; day < 12; day++) auction(empty, "BLIND", "UNSOLD", null, day);
        mvc.perform(get(emptyPath).param("page", "1").session(session("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.history.totalElements").value(12))
            .andExpect(jsonPath("$.history.totalPages").value(2))
            .andExpect(jsonPath("$.history.items.length()").value(2))
            .andExpect(jsonPath("$.trend.length()").value(0));
        mvc.perform(get(emptyPath).param("page", "-1").session(session("ADMIN"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/products/invalid/statistics").session(session("ADMIN"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/products/9223372036854775807/statistics").session(session("ADMIN"))).andExpect(status().isNotFound());
    }
}
