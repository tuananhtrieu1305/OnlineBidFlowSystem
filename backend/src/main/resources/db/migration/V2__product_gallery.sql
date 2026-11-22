CREATE TABLE IF NOT EXISTS product_gallery_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_product_gallery_order (product_id, id),
    CONSTRAINT fk_product_gallery_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
