CREATE TABLE IF NOT EXISTS blind_system_clues (
    auction_id BIGINT UNSIGNED NOT NULL,
    slot INT NOT NULL,
    content VARCHAR(500) NOT NULL,
    PRIMARY KEY (auction_id, slot),
    CONSTRAINT fk_blind_system_clues_auction
        FOREIGN KEY (auction_id) REFERENCES auctions(id),
    CONSTRAINT chk_blind_system_clue_slot CHECK (slot BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE blind_clues
    DROP CONSTRAINT chk_blind_clue_slot,
    ADD CONSTRAINT chk_blind_clue_pool_slot CHECK (slot BETWEEN 1 AND 100);
