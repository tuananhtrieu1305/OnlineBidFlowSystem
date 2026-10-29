package com.group6.auction.product.statistics;

import com.group6.auction.product.service.ProductException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!probe")
public class ProductStatisticsService {
    private static final int HISTORY_SIZE = 10;
    private final JdbcTemplate jdbc;

    public ProductStatisticsService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Counts(long total, long upcoming, long running, long sold, long unsold) {}
    public record TypeCounts(String type, long total, long sold, long unsold, String averagePrice) {}
    public record Prices(long soldCount, String average, String median, String minimum, String maximum, String latest) {}
    public record AuctionPoint(String id, String type, String finishedAt, String winningPrice) {}
    public record AuctionHistoryRow(String id, String type, String status, String finishedAt, String winningPrice) {}
    public record History(List<AuctionHistoryRow> items, int page, int size, long totalElements, long totalPages) {}
    public record Statistics(Counts counts, List<TypeCounts> byType, Prices prices,
                             List<AuctionPoint> trend, History history) {}

    private String iso(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC).toString();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Statistics get(long productId, int page) {
        if (productId <= 0 || page < 0 || (long) page * HISTORY_SIZE > Integer.MAX_VALUE)
            throw new ProductException(400, "INVALID_FILTER");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id=?", Long.class, productId) == 0)
            throw new ProductException(404, "PRODUCT_NOT_FOUND");

        Counts counts = jdbc.queryForObject("""
            SELECT COUNT(*),
                   COALESCE(SUM(status='UPCOMING'),0), COALESCE(SUM(status='RUNNING'),0),
                   COALESCE(SUM(status='SOLD'),0), COALESCE(SUM(status='UNSOLD'),0)
            FROM auctions WHERE product_id=?
            """, (rs, n) -> new Counts(rs.getLong(1), rs.getLong(2), rs.getLong(3),
                rs.getLong(4), rs.getLong(5)), productId);

        List<TypeCounts> byType = jdbc.query("""
            SELECT auction_type, COUNT(*), COALESCE(SUM(status='SOLD'),0),
                   COALESCE(SUM(status='UNSOLD'),0),
                   CAST(ROUND(AVG(CASE WHEN status='SOLD' THEN winning_price END),0) AS CHAR)
            FROM auctions WHERE product_id=? GROUP BY auction_type ORDER BY auction_type
            """, (rs, n) -> new TypeCounts(rs.getString(1), rs.getLong(2), rs.getLong(3),
                rs.getLong(4), rs.getString(5)), productId);

        Prices base = jdbc.queryForObject("""
            SELECT COUNT(*), CAST(ROUND(AVG(winning_price),0) AS CHAR),
                   CAST(MIN(winning_price) AS CHAR), CAST(MAX(winning_price) AS CHAR)
            FROM auctions
            WHERE product_id=? AND status='SOLD' AND finished_at IS NOT NULL AND winning_price IS NOT NULL
            """, (rs, n) -> new Prices(rs.getLong(1), rs.getString(2), null,
                rs.getString(3), rs.getString(4), null), productId);
        String median = null, latest = null;
        if (base.soldCount() >= 5) {
            median = jdbc.queryForObject("""
                SELECT CAST(ROUND(AVG(winning_price),0) AS CHAR)
                FROM (
                    SELECT winning_price, ROW_NUMBER() OVER (ORDER BY winning_price,id) AS price_rank,
                           COUNT(*) OVER () AS sample_size
                    FROM auctions
                    WHERE product_id=? AND status='SOLD' AND finished_at IS NOT NULL AND winning_price IS NOT NULL
                ) ranked
                WHERE price_rank IN (FLOOR((sample_size+1)/2), FLOOR((sample_size+2)/2))
                """, String.class, productId);
        }
        if (base.soldCount() > 0) {
            latest = jdbc.queryForObject("""
                SELECT CAST(winning_price AS CHAR) FROM auctions
                WHERE product_id=? AND status='SOLD' AND finished_at IS NOT NULL AND winning_price IS NOT NULL
                ORDER BY finished_at DESC,id DESC LIMIT 1
                """, String.class, productId);
        }
        Prices prices = new Prices(base.soldCount(), base.average(), median,
            base.minimum(), base.maximum(), latest);

        List<AuctionPoint> trend = jdbc.query("""
            SELECT id,auction_type,finished_at,CAST(winning_price AS CHAR)
            FROM auctions
            WHERE product_id=? AND status='SOLD' AND finished_at IS NOT NULL AND winning_price IS NOT NULL
            ORDER BY finished_at DESC,id DESC LIMIT 10
            """, (rs, n) -> new AuctionPoint(rs.getString(1), rs.getString(2),
                iso(rs.getObject(3, LocalDateTime.class)), rs.getString(4)), productId);

        long totalFinished = counts.sold() + counts.unsold();
        List<AuctionHistoryRow> history = jdbc.query("""
            SELECT id,auction_type,status,finished_at,CAST(winning_price AS CHAR)
            FROM auctions WHERE product_id=? AND status IN ('SOLD','UNSOLD')
            ORDER BY finished_at DESC,id DESC LIMIT ? OFFSET ?
            """, (rs, n) -> new AuctionHistoryRow(rs.getString(1), rs.getString(2),
                rs.getString(3), iso(rs.getObject(4, LocalDateTime.class)), rs.getString(5)),
            productId, HISTORY_SIZE, (long) page * HISTORY_SIZE);
        return new Statistics(counts, byType, prices, trend,
            new History(history, page, HISTORY_SIZE, totalFinished,
                (totalFinished + HISTORY_SIZE - 1) / HISTORY_SIZE));
    }
}
