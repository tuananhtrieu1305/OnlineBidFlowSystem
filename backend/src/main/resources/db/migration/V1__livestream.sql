-- Forward migration. Downgrading requires retiring LIVESTREAM records first.
ALTER TABLE auctions DROP CHECK chk_auctions_type_increment;
ALTER TABLE auctions DROP CHECK chk_auctions_time;
ALTER TABLE auctions MODIFY auction_type ENUM('NORMAL','BLIND','LIVESTREAM') NOT NULL,
    MODIFY end_time DATETIME(6) NULL;
ALTER TABLE auctions ADD CONSTRAINT chk_auctions_type_increment CHECK (
    (auction_type='NORMAL' AND min_bid_increment IS NOT NULL AND min_bid_increment>0)
    OR (auction_type IN ('BLIND','LIVESTREAM') AND min_bid_increment IS NULL));
ALTER TABLE auctions ADD CONSTRAINT chk_auctions_time CHECK (
    (auction_type='LIVESTREAM' AND (end_time IS NULL OR end_time>start_time))
    OR (auction_type IN ('NORMAL','BLIND') AND end_time IS NOT NULL AND end_time>start_time));
ALTER TABLE bids ADD COLUMN request_id VARCHAR(36) NULL,
    ADD UNIQUE KEY uk_bid_request (auction_id,user_id,request_id);

CREATE TABLE livestream_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    host_id BIGINT UNSIGNED NOT NULL,
    create_request_id VARCHAR(36) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    starts_at DATETIME(6) NOT NULL,
    status ENUM('SCHEDULED','LIVE','PAUSED','ENDED') NOT NULL DEFAULT 'SCHEDULED',
    current_lot_index INT UNSIGNED NOT NULL DEFAULT 0,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    host_socket_id VARCHAR(100) NULL,
    host_last_seen DATETIME(6) NULL,
    publisher_ready BOOLEAN NOT NULL DEFAULT FALSE,
    media_generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
    remaining_ms BIGINT NULL,
    pause_until DATETIME(6) NULL,
    CONSTRAINT fk_livestream_host FOREIGN KEY (host_id) REFERENCES users(id),
    UNIQUE KEY uk_live_create (host_id,create_request_id),
    KEY idx_live_lifecycle(status,pause_until,host_last_seen)
) ENGINE=InnoDB;
CREATE TABLE livestream_lots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,
    auction_id BIGINT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL,
    phase ENUM('QUEUED','PRESENTING','OPEN','SOLD','UNSOLD') NOT NULL DEFAULT 'QUEUED',
    CONSTRAINT fk_live_lot_session FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    CONSTRAINT fk_live_lot_auction FOREIGN KEY(auction_id) REFERENCES auctions(id),
    UNIQUE KEY uk_live_auction(auction_id),
    UNIQUE KEY uk_live_position(session_id,position)
) ENGINE=InnoDB;
CREATE TABLE livestream_participants (
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    seat_number INT UNSIGNED NOT NULL,
    PRIMARY KEY(session_id,user_id),
    UNIQUE KEY uk_live_seat(session_id,seat_number),
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE livestream_registrations (
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY(session_id,user_id),
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE livestream_chat (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    content VARCHAR(500) NOT NULL,
    sent_at DATETIME(6) NOT NULL,
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE KEY uk_live_chat_request(session_id,user_id,request_id),
    KEY idx_live_chat(session_id,id)
) ENGINE=InnoDB;
CREATE TABLE livestream_notifications (
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY(session_id,user_id),
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE livestream_commands (
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    command VARCHAR(20) NOT NULL,
    lot_id BIGINT UNSIGNED NULL,
    PRIMARY KEY(session_id,user_id,request_id),
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
