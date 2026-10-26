-- Apply once to an existing auction_db. Preserve all existing rows and volumes.
USE auction_db;

ALTER TABLE coin_transactions
  MODIFY COLUMN transaction_type ENUM('DEPOSIT','LOCK','UNLOCK','PAYMENT','CLUE_TRADE') NOT NULL;

CREATE TABLE blind_clues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  auction_id BIGINT UNSIGNED NOT NULL,
  slot TINYINT UNSIGNED NOT NULL,
  content VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_blind_clue_slot (auction_id, slot),
  UNIQUE KEY uk_blind_clue_auction_id (auction_id, id),
  CONSTRAINT fk_blind_clue_auction FOREIGN KEY (auction_id) REFERENCES auctions (id),
  CONSTRAINT chk_blind_clue_slot CHECK (slot BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE blind_rounds (
  auction_id BIGINT UNSIGNED NOT NULL,
  started_at DATETIME(6) NOT NULL,
  trade_ends_at DATETIME(6) NOT NULL,
  bid_locks_at DATETIME(6) NOT NULL,
  ends_at DATETIME(6) NOT NULL,
  PRIMARY KEY (auction_id),
  CONSTRAINT fk_blind_round_auction FOREIGN KEY (auction_id) REFERENCES auctions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE blind_clue_ownership (
  auction_id BIGINT UNSIGNED NOT NULL,
  clue_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  acquired_at DATETIME(6) NOT NULL,
  PRIMARY KEY (clue_id, user_id),
  KEY idx_blind_owned_user (auction_id, user_id),
  CONSTRAINT fk_blind_owned_clue FOREIGN KEY (auction_id, clue_id) REFERENCES blind_clues (auction_id, id),
  CONSTRAINT fk_blind_owned_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE blind_clue_listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  auction_id BIGINT UNSIGNED NOT NULL,
  clue_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  price BIGINT UNSIGNED NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_blind_listing (clue_id, seller_id),
  KEY idx_blind_listing_auction (auction_id, active),
  CONSTRAINT fk_blind_listing_clue FOREIGN KEY (auction_id, clue_id) REFERENCES blind_clues (auction_id, id),
  CONSTRAINT fk_blind_listing_seller FOREIGN KEY (seller_id) REFERENCES users (id),
  CONSTRAINT chk_blind_listing_price CHECK (price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE blind_clue_trades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  auction_id BIGINT UNSIGNED NOT NULL,
  clue_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  price BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_blind_trade_clue FOREIGN KEY (auction_id, clue_id) REFERENCES blind_clues (auction_id, id),
  CONSTRAINT fk_blind_trade_listing FOREIGN KEY (listing_id) REFERENCES blind_clue_listings (id),
  CONSTRAINT fk_blind_trade_buyer FOREIGN KEY (buyer_id) REFERENCES users (id),
  CONSTRAINT fk_blind_trade_seller FOREIGN KEY (seller_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
