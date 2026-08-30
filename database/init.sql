CREATE DATABASE IF NOT EXISTS auction_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE auction_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS coin_transactions;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS bids;
DROP TABLE IF EXISTS auction_participants;
DROP TABLE IF EXISTS auctions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

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
INSERT INTO users (id, username, password_hash, role) VALUES
(1, 'admin', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'ADMIN'),
(2, 'alice', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(3, 'bob', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(4, 'charlie', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(5, 'diana', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(6, 'eric', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(7, 'fiona', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(8, 'george', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(9, 'hana', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER'),
(10, 'ivan', '$2a$10$zI0fqCDqQAO.Suqgo3Kvf.7dq8ilwZr4hFpgkw43cU1u0aVgOeMR2', 'USER');

-- Wallets. Wallet id 1 is the only SYSTEM wallet.
INSERT INTO wallets (id, user_id, wallet_type, available_balance, locked_balance, updated_at) VALUES
(1, NULL, 'SYSTEM', 1500, 0, '2026-06-01 11:00:00.000000'),
(2, 2, 'USER', 4400, 4100, '2026-08-30 09:20:00.000000'),
(3, 3, 'USER', 9000, 0, '2026-06-01 10:20:00.000000'),
(4, 4, 'USER', 8500, 0, '2026-06-15 09:20:00.000000'),
(5, 5, 'USER', 7500, 0, '2026-06-15 09:30:00.000000'),
(6, 6, 'USER', 5450, 1550, '2026-08-30 09:10:00.000000'),
(7, 7, 'USER', 6000, 0, '2026-08-30 09:15:00.000000'),
(8, 8, 'USER', 9500, 0, '2026-07-10 14:00:00.000000'),
(9, 9, 'USER', 3900, 0, '2026-07-20 16:00:00.000000'),
(10, 10, 'USER', 8200, 0, '2026-07-20 15:40:00.000000');

-- Products.
-- Products.
INSERT INTO products (id, name, description, estimated_price, quantity, image_url) VALUES
(1, 'Vintage Camera', 'Classic film camera for repeat auction statistics.', 1400, 3,
 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80'),

(2, 'Mechanical Keyboard', 'Hot-swappable keyboard with aluminum case.', 1100, 5,
 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80'),

(3, 'Wireless Headphones', 'Noise-canceling over-ear headphones.', 1800, 4,
 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80'),

(4, 'Collector Watch', 'Limited collector watch in good condition.', 2500, 2,
 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80'),

(5, 'Gaming Monitor', '27 inch high-refresh-rate monitor.', 3200, 2,
 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=1200&q=80'),

(6, 'Tablet Pro', 'Tablet for design and study work.', 3900, 2,
 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80'),

(7, 'Smart Speaker', 'Compact smart speaker.', 700, 8,
 'https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=1200&q=80'),

(8, 'Drone Mini', 'Small drone with camera.', 2800, 2,
 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80'),

(9, 'Espresso Machine', 'Entry-level espresso machine.', 2300, 1,
 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=1200&q=80'),

(10, 'Desk Lamp', 'Adjustable LED desk lamp.', 450, 10,
 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=80');

-- Auctions. Includes NORMAL, BLIND, PUBLIC, PRIVATE, SOLD, UNSOLD, RUNNING, and UPCOMING samples.
INSERT INTO auctions (
    id, product_id, created_by, auction_type, access_type, room_code, max_participants,
    starting_price, min_bid_increment, start_time, end_time, finished_at, status,
    winner_user_id, winning_price
) VALUES
(1, 1, 1, 'NORMAL', 'PUBLIC', NULL, NULL, 1000, 100, '2026-06-01 09:00:00.000000', '2026-06-01 10:00:00.000000', '2026-06-01 10:00:00.000000', 'SOLD', 2, 1500),
(2, 1, 1, 'BLIND', 'PUBLIC', NULL, NULL, 1200, NULL, '2026-06-15 09:00:00.000000', '2026-06-15 10:00:00.000000', '2026-06-15 10:00:00.000000', 'SOLD', 3, 1800),
(3, 1, 1, 'BLIND', 'PRIVATE', 'CAMERA26', 5, 1300, NULL, '2026-08-30 00:00:00.000000', '2026-12-31 23:59:59.000000', NULL, 'RUNNING', NULL, NULL),
(4, 2, 1, 'NORMAL', 'PUBLIC', NULL, NULL, 1000, 100, '2026-06-20 09:00:00.000000', '2026-06-20 10:00:00.000000', '2026-06-20 10:00:00.000000', 'UNSOLD', NULL, NULL),
(5, 2, 1, 'NORMAL', 'PRIVATE', 'KEYROOM', 6, 2000, 150, '2026-08-30 00:00:00.000000', '2026-12-31 23:59:59.000000', NULL, 'RUNNING', NULL, NULL),
(6, 3, 1, 'NORMAL', 'PUBLIC', NULL, NULL, 1500, 100, '2027-01-05 09:00:00.000000', '2027-01-05 10:00:00.000000', NULL, 'UPCOMING', NULL, NULL),
(7, 4, 1, 'BLIND', 'PUBLIC', NULL, NULL, 2400, NULL, '2027-01-10 09:00:00.000000', '2027-01-10 10:00:00.000000', NULL, 'UPCOMING', NULL, NULL),
(8, 5, 1, 'NORMAL', 'PRIVATE', 'MONITORVIP', 4, 2800, 200, '2026-07-10 13:00:00.000000', '2026-07-10 14:00:00.000000', '2026-07-10 14:00:00.000000', 'SOLD', 8, 3500),
(9, 6, 1, 'BLIND', 'PRIVATE', 'TABLET26', 4, 4000, NULL, '2026-07-20 15:00:00.000000', '2026-07-20 16:00:00.000000', '2026-07-20 16:00:00.000000', 'SOLD', 9, 4100),
(10, 7, 1, 'BLIND', 'PUBLIC', NULL, NULL, 900, NULL, '2026-07-25 09:00:00.000000', '2026-07-25 10:00:00.000000', '2026-07-25 10:00:00.000000', 'UNSOLD', NULL, NULL);

-- Auction participants. Winners of SOLD auctions are real participants.
INSERT INTO auction_participants (auction_id, user_id, joined_at) VALUES
(1, 2, '2026-06-01 09:01:00.000000'),
(1, 3, '2026-06-01 09:02:00.000000'),
(1, 4, '2026-06-01 09:03:00.000000'),
(2, 3, '2026-06-15 09:01:00.000000'),
(2, 4, '2026-06-15 09:02:00.000000'),
(2, 5, '2026-06-15 09:03:00.000000'),
(3, 2, '2026-08-30 09:00:00.000000'),
(3, 6, '2026-08-30 09:01:00.000000'),
(4, 5, '2026-06-20 09:05:00.000000'),
(5, 2, '2026-08-30 09:05:00.000000'),
(5, 7, '2026-08-30 09:06:00.000000'),
(8, 8, '2026-07-10 13:01:00.000000'),
(8, 2, '2026-07-10 13:02:00.000000'),
(9, 9, '2026-07-20 15:01:00.000000'),
(9, 10, '2026-07-20 15:02:00.000000');

-- Bids. Auction 1 shows one NORMAL user bidding multiple times. Auction 2 shows BLIND tie-breaking.
INSERT INTO bids (id, auction_id, user_id, amount, created_at) VALUES
(1, 1, 2, 1200, '2026-06-01 09:10:00.100000'),
(2, 1, 3, 1300, '2026-06-01 09:15:00.200000'),
(3, 1, 2, 1500, '2026-06-01 09:30:00.300000'),
(4, 2, 3, 1800, '2026-06-15 09:10:00.100000'),
(5, 2, 4, 1800, '2026-06-15 09:10:00.200000'),
(6, 2, 5, 1700, '2026-06-15 09:20:00.300000'),
(7, 3, 2, 1600, '2026-08-30 09:10:00.100000'),
(8, 3, 6, 1550, '2026-08-30 09:12:00.200000'),
(9, 5, 2, 2200, '2026-08-30 09:15:00.100000'),
(10, 5, 7, 2350, '2026-08-30 09:18:00.200000'),
(11, 5, 2, 2500, '2026-08-30 09:20:00.300000'),
(12, 8, 2, 3200, '2026-07-10 13:20:00.100000'),
(13, 8, 8, 3500, '2026-07-10 13:40:00.200000'),
(14, 9, 9, 4100, '2026-07-20 15:20:00.100000'),
(15, 9, 10, 3900, '2026-07-20 15:30:00.200000');

-- Chat messages from multiple users in auction rooms.
INSERT INTO chat_messages (id, auction_id, user_id, content, sent_at) VALUES
(1, 1, 2, 'Good luck everyone.', '2026-06-01 09:05:00.000000'),
(2, 1, 3, 'Let us start.', '2026-06-01 09:06:00.000000'),
(3, 1, 4, 'Watching the price.', '2026-06-01 09:07:00.000000'),
(4, 2, 3, 'Blind round submitted.', '2026-06-15 09:11:00.000000'),
(5, 2, 5, 'I placed my bid.', '2026-06-15 09:21:00.000000'),
(6, 3, 2, 'Private camera room joined.', '2026-08-30 09:02:00.000000'),
(7, 3, 6, 'Ready for blind auction.', '2026-08-30 09:03:00.000000'),
(8, 5, 2, 'Keyboard auction is active.', '2026-08-30 09:07:00.000000'),
(9, 5, 7, 'I am following the increments.', '2026-08-30 09:19:00.000000'),
(10, 5, 2, 'New bid placed.', '2026-08-30 09:21:00.000000'),
(11, 8, 8, 'Monitor looks great.', '2026-07-10 13:05:00.000000'),
(12, 8, 2, 'Final minutes.', '2026-07-10 13:50:00.000000');

-- Coin transaction examples for DEPOSIT, LOCK, UNLOCK, and PAYMENT.
INSERT INTO coin_transactions (id, wallet_id, auction_id, transaction_type, available_delta, locked_delta, created_at) VALUES
(1, 2, NULL, 'DEPOSIT', 10000, 0, '2026-05-30 08:00:00.000000'),
(2, 3, NULL, 'DEPOSIT', 9000, 0, '2026-05-30 08:05:00.000000'),
(3, 4, NULL, 'DEPOSIT', 8500, 0, '2026-05-30 08:10:00.000000'),
(4, 5, NULL, 'DEPOSIT', 7500, 0, '2026-05-30 08:15:00.000000'),
(5, 6, NULL, 'DEPOSIT', 7000, 0, '2026-05-30 08:20:00.000000'),
(6, 2, 1, 'LOCK', -1500, 1500, '2026-06-01 09:30:00.300000'),
(7, 3, 1, 'LOCK', -1300, 1300, '2026-06-01 09:15:00.200000'),
(8, 3, 1, 'UNLOCK', 1300, -1300, '2026-06-01 09:30:01.000000'),
(9, 2, 1, 'PAYMENT', 0, -1500, '2026-06-01 10:00:01.000000'),
(10, 1, 1, 'PAYMENT', 1500, 0, '2026-06-01 10:00:02.000000'),
(11, 2, 3, 'LOCK', -1600, 1600, '2026-08-30 09:10:01.000000'),
(12, 6, 3, 'LOCK', -1550, 1550, '2026-08-30 09:12:01.000000');
