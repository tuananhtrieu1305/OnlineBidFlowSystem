CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER','ADMIN') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wallets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    wallet_type ENUM('USER','SYSTEM') NOT NULL,
    available_balance BIGINT UNSIGNED NOT NULL,
    locked_balance BIGINT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_wallets_user_id (user_id),
    CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT chk_wallets_user_type CHECK (
        (wallet_type = 'USER' AND user_id IS NOT NULL)
        OR (wallet_type = 'SYSTEM' AND user_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    estimated_price BIGINT UNSIGNED NULL,
    quantity INT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auctions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    auction_type ENUM('NORMAL','BLIND') NOT NULL,
    access_type ENUM('PUBLIC','PRIVATE') NOT NULL,
    room_code VARCHAR(50) NULL,
    max_participants INT UNSIGNED NULL,
    starting_price BIGINT UNSIGNED NOT NULL,
    min_bid_increment BIGINT UNSIGNED NULL,
    start_time DATETIME(6) NOT NULL,
    end_time DATETIME(6) NOT NULL,
    finished_at DATETIME(6) NULL,
    status ENUM('UPCOMING','RUNNING','SOLD','UNSOLD') NOT NULL,
    winner_user_id BIGINT UNSIGNED NULL,
    winning_price BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_auctions_product FOREIGN KEY (product_id) REFERENCES products (id),
    CONSTRAINT fk_auctions_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_auctions_winner FOREIGN KEY (winner_user_id) REFERENCES users (id),
    CONSTRAINT chk_auctions_starting_price CHECK (starting_price > 0),
    CONSTRAINT chk_auctions_time CHECK (end_time > start_time),
    CONSTRAINT chk_auctions_type_increment CHECK (
        (auction_type = 'NORMAL' AND min_bid_increment IS NOT NULL AND min_bid_increment > 0)
        OR (auction_type = 'BLIND' AND min_bid_increment IS NULL)
    ),
    CONSTRAINT chk_auctions_access_room CHECK (
        (access_type = 'PUBLIC' AND room_code IS NULL)
        OR (access_type = 'PRIVATE' AND room_code IS NOT NULL)
    ),
    CONSTRAINT chk_auctions_result CHECK (
        (status = 'SOLD' AND winner_user_id IS NOT NULL AND winning_price IS NOT NULL AND finished_at IS NOT NULL)
        OR (status = 'UNSOLD' AND winner_user_id IS NULL AND winning_price IS NULL AND finished_at IS NOT NULL)
        OR (status IN ('UPCOMING','RUNNING') AND winner_user_id IS NULL AND winning_price IS NULL AND finished_at IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auction_participants (
    auction_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    joined_at DATETIME(6) NOT NULL,
    PRIMARY KEY (auction_id, user_id),
    CONSTRAINT fk_participants_auction FOREIGN KEY (auction_id) REFERENCES auctions (id),
    CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bids (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    auction_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    amount BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_bids_auction FOREIGN KEY (auction_id) REFERENCES auctions (id),
    CONSTRAINT fk_bids_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    auction_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    sent_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_chat_messages_auction FOREIGN KEY (auction_id) REFERENCES auctions (id),
    CONSTRAINT fk_chat_messages_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coin_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    wallet_id BIGINT UNSIGNED NOT NULL,
    auction_id BIGINT UNSIGNED NULL,
    transaction_type ENUM('DEPOSIT','LOCK','UNLOCK','PAYMENT') NOT NULL,
    available_delta BIGINT NOT NULL,
    locked_delta BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_coin_transactions_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT fk_coin_transactions_auction FOREIGN KEY (auction_id) REFERENCES auctions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_auctions_product_status_finished ON auctions (product_id, status, finished_at);
CREATE INDEX idx_auctions_status_time ON auctions (status, start_time, end_time);
CREATE INDEX idx_bids_auction_amount_created ON bids (auction_id, amount DESC, created_at ASC);
CREATE INDEX idx_chat_messages_auction_sent ON chat_messages (auction_id, sent_at);
CREATE INDEX idx_coin_transactions_wallet_created ON coin_transactions (wallet_id, created_at);

-- Users. Development password for all seed accounts: Password@123


INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES(NULL,'SYSTEM',0,0,UTC_TIMESTAMP(6));
