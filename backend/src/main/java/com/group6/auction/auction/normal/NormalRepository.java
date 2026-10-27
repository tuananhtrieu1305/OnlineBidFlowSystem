package com.group6.auction.auction.normal;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import com.group6.auction.auction.normal.NormalDtos.*;

@Repository
@Profile("!probe")
@ConditionalOnProperty(name = "app.normal.enabled", havingValue = "true", matchIfMissing = true)
public class NormalRepository {
    private final JdbcTemplate jdbc;
    public NormalRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Account(long id, String username, String role) { public boolean admin() { return "ADMIN".equals(role); } }
    public record Auction(long id, long productId, String type, String access, String roomCode, Integer capacity,
                          long startingPrice, long increment, Instant startsAt, Instant endsAt,
                          Instant finishedAt, String status, Long winningPrice) {}

    public Account account(String username) {
        var rows = jdbc.query("SELECT id, username, role FROM users WHERE username = ?",
                (rs, row) -> new Account(rs.getLong("id"), rs.getString("username"), rs.getString("role")), username);
        if (rows.isEmpty()) throw NormalException.forbidden("Tài khoản không còn tồn tại.");
        return rows.getFirst();
    }

    public List<Summary> list(Account user) {
        return jdbc.query("""
                SELECT a.id, a.access_type, a.status, a.start_time, a.end_time,
                       p.id AS product_id, p.name, p.description, p.quantity, p.image_url,
                       CASE WHEN ap.user_id IS NULL THEN FALSE ELSE TRUE END AS joined
                FROM auctions a JOIN products p ON p.id = a.product_id
                LEFT JOIN auction_participants ap ON ap.auction_id = a.id AND ap.user_id = ?
                WHERE a.auction_type = 'NORMAL' ORDER BY a.start_time DESC, a.id DESC
                """, (rs, row) -> new Summary(rs.getLong("id"), product(rs), rs.getString("access_type"),
                rs.getString("status"), instant(rs, "start_time"), instant(rs, "end_time"), rs.getBoolean("joined")), user.id());
    }

    public Auction auction(long id, boolean lock) {
        // Lock the auction alone first, before touching bids/wallets. Same order for bid/join/finish.
        var rows = jdbc.query("SELECT * FROM auctions WHERE id = ?" + (lock ? " FOR UPDATE" : ""), (rs, row) ->
                new Auction(rs.getLong("id"), rs.getLong("product_id"), rs.getString("auction_type"),
                        rs.getString("access_type"), rs.getString("room_code"), rs.getObject("max_participants", Integer.class),
                        rs.getLong("starting_price"), rs.getLong("min_bid_increment"), instant(rs, "start_time"),
                        instant(rs, "end_time"), instant(rs, "finished_at"), rs.getString("status"),
                        rs.getObject("winning_price", Long.class)), id);
        if (rows.isEmpty() || !"NORMAL".equals(rows.getFirst().type()))
            throw new NormalException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Không tìm thấy phiên NORMAL.");
        return rows.getFirst();
    }

    public Product product(long productId) {
        return jdbc.queryForObject("SELECT id AS product_id, name, description, quantity, image_url FROM products WHERE id = ?",
                (rs, row) -> product(rs), productId);
    }
    private Product product(ResultSet rs) throws SQLException {
        return new Product(rs.getLong("product_id"), rs.getString("name"), rs.getString("description"), rs.getInt("quantity"), rs.getString("image_url"));
    }
    public List<Bid> bids(long id) {
        return jdbc.query("""
                SELECT b.id, b.user_id, u.username, b.amount, b.created_at FROM bids b
                JOIN users u ON u.id = b.user_id WHERE b.auction_id = ? ORDER BY b.created_at, b.id
                """, (rs, row) -> new Bid(rs.getLong("id"), rs.getLong("user_id"), rs.getString("username"), rs.getLong("amount"), instant(rs, "created_at")), id);
    }
    public boolean joined(long id, long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id = ? AND user_id = ?", Long.class, id, userId) > 0;
    }
    public long bid(long id, long userId, long amount, Instant now) {
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("INSERT INTO bids (auction_id, user_id, amount, created_at) VALUES (?, ?, ?, ?)", java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, id); statement.setLong(2, userId); statement.setLong(3, amount);
            statement.setObject(4, LocalDateTime.ofInstant(now, ZoneOffset.UTC));
            return statement;
        }, key);
        return java.util.Objects.requireNonNull(key.getKey()).longValue();
    }
    public String winner(long id) {
        return jdbc.queryForObject("SELECT u.username FROM auctions a LEFT JOIN users u ON u.id = a.winner_user_id WHERE a.id = ?", String.class, id);
    }
    public void extend(long id, Instant endsAt) {
        jdbc.update("UPDATE auctions SET end_time=? WHERE id=?", LocalDateTime.ofInstant(endsAt, ZoneOffset.UTC), id);
    }
    public List<Long> due(Instant now) {
        return jdbc.queryForList("SELECT id FROM auctions WHERE auction_type = 'NORMAL' AND status = 'RUNNING' AND end_time <= ? ORDER BY id", Long.class, LocalDateTime.ofInstant(now, ZoneOffset.UTC));
    }
    private static Instant instant(ResultSet rs, String field) throws SQLException {
        LocalDateTime value = rs.getObject(field, LocalDateTime.class);
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}
