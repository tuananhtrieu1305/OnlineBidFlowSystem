package com.group6.auction.product.service;

import com.group6.auction.auction.configuration.AuctionConfigurationException;
import com.group6.auction.product.repository.ProductStockSql;
import org.springframework.jdbc.core.JdbcTemplate;

public final class ProductAvailability {
    private ProductAvailability() {}

    /** Caller holds the product row lock while reserving a unit. */
    public static void requireAvailable(JdbcTemplate jdbc, long productId, int quantity) {
        Long reserved = jdbc.queryForObject(
                "SELECT COUNT(*) FROM auctions a WHERE a.product_id=? AND " + ProductStockSql.RESERVED,
                Long.class, productId);
        if (reserved == null || reserved >= quantity) {
            throw new AuctionConfigurationException(409, "PRODUCT_OUT_OF_STOCK");
        }
    }
}
