package com.group6.auction.product.repository;

/** The same reservation rule is used by catalog filtering and transactional stock checks. */
public final class ProductStockSql {
    private ProductStockSql() {}

    public static final String RESERVED = """
            (a.status IN ('UPCOMING','RUNNING','SOLD') OR EXISTS (
              SELECT 1 FROM livestream_lots l JOIN livestream_sessions s ON s.id=l.session_id
              WHERE l.auction_id=a.id AND s.status<>'ENDED'))
            """;
    public static final String RESERVED_COUNT =
            "(SELECT COUNT(*) FROM auctions a WHERE a.product_id=p.id AND " + RESERVED + ")";
    public static final String AVAILABLE_FILTER =
            "(p.name LIKE :pattern ESCAPE '!' OR p.id=:exactId) AND p.quantity>" + RESERVED_COUNT;
}
