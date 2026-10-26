package com.group6.auction.leaderboard;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!probe")
public class LeaderboardService {
    private static final ZoneId GAME_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public LeaderboardService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public record Player(String id, String username, long rank, long wins, long played) {}
    public record Board(String type, String period, String month, List<Player> top, long totalPlayers) {}
    public record PersonalStats(long wins, long played, String coinSpent) {}
    public record Mine(Player publicRank, PersonalStats privateStats, PersonalStats allStats) {}
    private record Ranked(Player player, long rowNumber) {}
    private record Filter(String type, String period, String month,
                          LocalDateTime fromUtc, LocalDateTime untilUtc) {}

    private Filter filter(String type, String period) {
        if (!"ALL".equals(type) && !"BLIND".equals(type))
            throw new LeaderboardException(400, "INVALID_TYPE");
        if (!"ALL_TIME".equals(period) && !"MONTH".equals(period))
            throw new LeaderboardException(400, "INVALID_PERIOD");
        if ("ALL_TIME".equals(period)) return new Filter(type, period, null, null, null);
        YearMonth month = YearMonth.from(clock.instant().atZone(GAME_ZONE));
        LocalDateTime start = LocalDateTime.ofInstant(month.atDay(1).atStartOfDay(GAME_ZONE).toInstant(), ZoneOffset.UTC);
        LocalDateTime end = LocalDateTime.ofInstant(month.plusMonths(1).atDay(1).atStartOfDay(GAME_ZONE).toInstant(), ZoneOffset.UTC);
        return new Filter(type, period, month.toString(), start, end);
    }

    private String eligibility(Filter filter, String visibility) {
        StringBuilder where = new StringBuilder("a.access_type='" + visibility + "'"
            + " AND a.status IN ('SOLD','UNSOLD') AND a.finished_at IS NOT NULL"
            + " AND (a.auction_type='NORMAL' OR br.auction_id IS NOT NULL)");
        if ("BLIND".equals(filter.type())) where.append(" AND a.auction_type='BLIND'");
        if (filter.fromUtc() != null) where.append(" AND a.finished_at>=? AND a.finished_at<?");
        return where.toString();
    }

    private List<Object> dates(Filter filter) {
        List<Object> args = new ArrayList<>();
        if (filter.fromUtc() != null) { args.add(filter.fromUtc()); args.add(filter.untilUtc()); }
        return args;
    }

    private String rankingSql(Filter filter) {
        return """
            WITH scores AS (
              SELECT p.user_id,u.username,COUNT(*) AS played,
                     SUM(CASE WHEN a.status='SOLD' AND a.winner_user_id=p.user_id THEN 1 ELSE 0 END) AS wins
              FROM auction_participants p
              JOIN auctions a ON a.id=p.auction_id
              JOIN users u ON u.id=p.user_id AND u.role='USER'
              LEFT JOIN blind_rounds br ON br.auction_id=a.id
              WHERE """ + " " + eligibility(filter, "PUBLIC") + """
              GROUP BY p.user_id,u.username
            ), ranked AS (
              SELECT user_id,username,played,wins,
                     DENSE_RANK() OVER (
                       ORDER BY wins DESC,CASE WHEN wins=0 THEN 0 ELSE played END ASC
                     ) AS rank_position,
                     ROW_NUMBER() OVER (
                       ORDER BY wins DESC,CASE WHEN wins=0 THEN 0 ELSE played END ASC,username ASC,user_id ASC
                     ) AS row_position
              FROM scores
            )
            SELECT CAST(user_id AS CHAR) AS user_id,username,played,wins,rank_position,row_position
            FROM ranked WHERE row_position<=10 OR user_id=?
            ORDER BY row_position
            """;
    }

    private List<Ranked> ranked(Filter filter, long viewerId) {
        List<Object> args = dates(filter);
        args.add(viewerId);
        return jdbc.query(rankingSql(filter), (rs, row) -> new Ranked(
            new Player(rs.getString(1), rs.getString(2), rs.getLong(5), rs.getLong(4), rs.getLong(3)),
            rs.getLong(6)), args.toArray());
    }

    private long totalPlayers(Filter filter) {
        List<Object> args = dates(filter);
        return jdbc.queryForObject("""
            SELECT COUNT(DISTINCT p.user_id)
            FROM auction_participants p
            JOIN auctions a ON a.id=p.auction_id
            JOIN users u ON u.id=p.user_id AND u.role='USER'
            LEFT JOIN blind_rounds br ON br.auction_id=a.id
            WHERE """ + " " + eligibility(filter, "PUBLIC"), Long.class, args.toArray());
    }

    private long userId(String username) {
        if (username == null) throw new LeaderboardException(401, "UNAUTHENTICATED");
        var ids = jdbc.queryForList("SELECT id FROM users WHERE username=? AND role='USER'", Long.class, username);
        if (ids.size() != 1) throw new LeaderboardException(403, "USER_REQUIRED");
        return ids.getFirst();
    }

    private PersonalStats personal(Filter filter, long userId, String visibility) {
        List<Object> args = new ArrayList<>();
        args.add(userId);
        args.addAll(dates(filter));
        return jdbc.queryForObject("""
            SELECT COUNT(*),
                   COALESCE(SUM(CASE WHEN a.status='SOLD' AND a.winner_user_id=p.user_id THEN 1 ELSE 0 END),0),
                   CAST(COALESCE(SUM(CASE WHEN a.status='SOLD' AND a.winner_user_id=p.user_id
                                          THEN a.winning_price ELSE 0 END),0) AS CHAR)
            FROM auction_participants p
            JOIN auctions a ON a.id=p.auction_id
            LEFT JOIN blind_rounds br ON br.auction_id=a.id
            WHERE p.user_id=? AND """ + " " + eligibility(filter, visibility),
            (rs, row) -> new PersonalStats(rs.getLong(2), rs.getLong(1), rs.getString(3)), args.toArray());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Board board(String type, String period) {
        Filter filter = filter(type, period);
        List<Player> top = ranked(filter, -1).stream().map(Ranked::player).toList();
        return new Board(filter.type(), filter.period(), filter.month(), top, totalPlayers(filter));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Mine mine(String type, String period, String username) {
        Filter filter = filter(type, period);
        long id = userId(username);
        Player publicRank = ranked(filter, id).stream()
            .map(Ranked::player).filter(player -> player.id().equals(Long.toString(id))).findFirst().orElse(null);
        PersonalStats privateStats = personal(filter, id, "PRIVATE");
        PersonalStats publicStats = personal(filter, id, "PUBLIC");
        return new Mine(publicRank, privateStats, new PersonalStats(
            privateStats.wins() + publicStats.wins(), privateStats.played() + publicStats.played(),
            new java.math.BigInteger(privateStats.coinSpent()).add(new java.math.BigInteger(publicStats.coinSpent())).toString()));
    }
}
