package com.group6.auction.auction.configuration;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.jdbc.core.ConnectionCallback;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.ZoneOffset;

/** Separate settings table keeps existing auction rows and BLIND configuration intact. */
@Repository
@Profile("!probe")
public class NormalTimingRepository {
    public record Timing(int closingWindowSeconds, int extensionSeconds, int leaderboardSeconds) {}
    public static final Timing DEFAULTS = new Timing(30, 30, 60);
    private final JdbcTemplate jdbc;

    public NormalTimingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        // Additive, idempotent bootstrap for existing installations without a migration runner.
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS auction_normal_timing (
                    auction_id BIGINT NOT NULL PRIMARY KEY,
                    closing_window_seconds INT NOT NULL,
                    extension_seconds INT NOT NULL,
                    leaderboard_seconds INT NOT NULL,
                    scheduled_end_time DATETIME(6) NULL
                )
                """);
        Boolean hasSchedule = jdbc.execute((ConnectionCallback<Boolean>) connection -> {
            try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), null, null, null)) {
                while (columns.next()) if ("auction_normal_timing".equalsIgnoreCase(columns.getString("TABLE_NAME")) && "scheduled_end_time".equalsIgnoreCase(columns.getString("COLUMN_NAME"))) return true;
                return false;
            }
        });
        if (!Boolean.TRUE.equals(hasSchedule)) jdbc.execute("ALTER TABLE auction_normal_timing ADD COLUMN scheduled_end_time DATETIME(6) NULL");
    }

    public Timing get(long id) {
        var values = jdbc.query("SELECT closing_window_seconds,extension_seconds,leaderboard_seconds FROM auction_normal_timing WHERE auction_id=?",
                (rs, row) -> new Timing(rs.getInt(1), rs.getInt(2), rs.getInt(3)), id);
        return values.isEmpty() ? DEFAULTS : values.getFirst();
    }

    public Instant scheduledEnd(long id, Instant fallback) {
        var values = jdbc.query("SELECT scheduled_end_time FROM auction_normal_timing WHERE auction_id=?",
                (rs, row) -> rs.getObject(1, LocalDateTime.class), id);
        return values.isEmpty() || values.getFirst() == null ? fallback : values.getFirst().toInstant(ZoneOffset.UTC);
    }

    /** Freeze the original deadline before the first extension of a legacy session. Caller holds auction lock. */
    public void rememberSchedule(long id, Instant end) {
        var values = jdbc.queryForList("SELECT scheduled_end_time FROM auction_normal_timing WHERE auction_id=?", LocalDateTime.class, id);
        if (values.isEmpty()) save(id, DEFAULTS, LocalDateTime.ofInstant(end, ZoneOffset.UTC));
        else jdbc.update("UPDATE auction_normal_timing SET scheduled_end_time=? WHERE auction_id=? AND scheduled_end_time IS NULL", LocalDateTime.ofInstant(end, ZoneOffset.UTC), id);
    }

    /** Caller holds the auction lock in the configuration transaction. */
    public void save(long id, Timing timing, LocalDateTime scheduledEnd) {
        jdbc.update("DELETE FROM auction_normal_timing WHERE auction_id=?", id);
        jdbc.update("INSERT INTO auction_normal_timing(auction_id,closing_window_seconds,extension_seconds,leaderboard_seconds,scheduled_end_time) VALUES (?,?,?,?,?)",
                id, timing.closingWindowSeconds(), timing.extensionSeconds(), timing.leaderboardSeconds(), scheduledEnd);
    }
}
