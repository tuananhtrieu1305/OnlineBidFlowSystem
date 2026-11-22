package com.group6.auction.auction.blind;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

public final class BlindClueRevealSchedule {
    static final int DISCUSS_SECONDS = 60;

    private BlindClueRevealSchedule() {}

    public record Reveal(int slot, String content, LocalDateTime at) {}

    public static List<Reveal> through(JdbcTemplate jdbc, long auctionId, LocalDateTime tradeEnd,
                                      LocalDateTime roundEnd, LocalDateTime cutoff) {
        LocalDateTime bidStart = tradeEnd.plusSeconds(DISCUSS_SECONDS);
        if (!cutoff.isAfter(bidStart) || !roundEnd.isAfter(bidStart)) return List.of();

        var clues = jdbc.query("""
                SELECT slot, content FROM blind_system_clues
                WHERE auction_id = ? ORDER BY slot
                """, (rs, row) -> new SystemClue(rs.getInt(1), rs.getString(2)), auctionId);
        long bidMillis = Duration.between(bidStart, roundEnd).toMillis();
        var revealed = new ArrayList<Reveal>();
        for (int i = 0; i < clues.size(); i++) {
            long offsetMillis = bidMillis * (i + 1) / (clues.size() + 1);
            LocalDateTime revealAt = bidStart.plusNanos(offsetMillis * 1_000_000);
            if (cutoff.isBefore(revealAt)) break;
            var clue = clues.get(i);
            revealed.add(new Reveal(clue.slot(), clue.content(), revealAt));
        }
        return revealed;
    }

    private record SystemClue(int slot, String content) {}
}
