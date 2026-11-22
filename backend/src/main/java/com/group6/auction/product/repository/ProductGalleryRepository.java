package com.group6.auction.product.repository;

import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("!probe")
public class ProductGalleryRepository {
    private final JdbcTemplate jdbc;

    public ProductGalleryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<String> imageUrls(long productId) {
        return jdbc.queryForList(
                "SELECT image_url FROM product_gallery_images WHERE product_id=? ORDER BY id",
                String.class, productId);
    }

    public void add(long productId, String url) {
        jdbc.update("INSERT INTO product_gallery_images (product_id, image_url) VALUES (?, ?)", productId, url);
    }
}
