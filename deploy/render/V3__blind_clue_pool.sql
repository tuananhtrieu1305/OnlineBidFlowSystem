-- TiDB can run with CHECK constraints disabled. Slot limits are validated by the application.
CREATE TABLE IF NOT EXISTS blind_system_clues (
    auction_id BIGINT UNSIGNED NOT NULL,
    slot INT NOT NULL,
    content VARCHAR(500) NOT NULL,
    PRIMARY KEY (auction_id, slot),
    CONSTRAINT fk_blind_system_clues_auction
        FOREIGN KEY (auction_id) REFERENCES auctions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
