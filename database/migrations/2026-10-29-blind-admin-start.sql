-- Apply once after 2026-10-26-blind-game.sql on an existing auction_db.
USE auction_db;

CREATE TABLE IF NOT EXISTS blind_settings (
  auction_id BIGINT UNSIGNED NOT NULL,
  trade_seconds INT UNSIGNED NOT NULL DEFAULT 300,
  bid_seconds INT UNSIGNED NOT NULL DEFAULT 100,
  PRIMARY KEY (auction_id),
  CONSTRAINT fk_blind_settings_auction FOREIGN KEY (auction_id) REFERENCES auctions (id),
  CONSTRAINT chk_blind_trade_seconds CHECK (trade_seconds BETWEEN 1 AND 3600),
  CONSTRAINT chk_blind_bid_seconds CHECK (bid_seconds BETWEEN 1 AND 3600)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
