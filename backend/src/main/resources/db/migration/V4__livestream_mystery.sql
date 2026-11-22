ALTER TABLE livestream_sessions
    ADD COLUMN mystery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN final_state ENUM('DISABLED','LOCKED','REVEALED','OPEN','SOLD','SKIPPED') NOT NULL DEFAULT 'DISABLED',
    ADD COLUMN mystery_config TEXT NULL;
ALTER TABLE livestream_lots ADD COLUMN lot_kind ENUM('REGULAR','SECRET') NOT NULL DEFAULT 'REGULAR';
CREATE TABLE livestream_mission_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    UNIQUE KEY uk_live_template_position(session_id,position),
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id)
) ENGINE=InnoDB;
CREATE TABLE livestream_mission_choices (
    template_id BIGINT UNSIGNED NOT NULL,
    group_key ENUM('A','B') NOT NULL,
    lot_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY(template_id,group_key,lot_id),
    FOREIGN KEY(template_id) REFERENCES livestream_mission_templates(id),
    FOREIGN KEY(lot_id) REFERENCES livestream_lots(id)
) ENGINE=InnoDB;
CREATE TABLE livestream_user_missions (
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    template_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL,
    PRIMARY KEY(session_id,user_id),
    FOREIGN KEY(session_id) REFERENCES livestream_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(template_id) REFERENCES livestream_mission_templates(id)
) ENGINE=InnoDB;
CREATE TABLE livestream_tickets (
    session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    issued_at DATETIME(6) NOT NULL,
    PRIMARY KEY(session_id,user_id),
    FOREIGN KEY(session_id,user_id) REFERENCES livestream_user_missions(session_id,user_id)
) ENGINE=InnoDB;
