-- Apply after 2026-10-29-blind-admin-start.sql.
ALTER TABLE blind_clues DROP CHECK chk_blind_clue_slot;
ALTER TABLE blind_clues ADD CONSTRAINT chk_blind_clue_slot CHECK (slot BETWEEN 1 AND 30);
ALTER TABLE blind_settings ADD COLUMN opened_at DATETIME(6) NULL;
ALTER TABLE auctions DROP CHECK chk_auctions_result;
ALTER TABLE auctions MODIFY COLUMN status ENUM('UPCOMING','RUNNING','SOLD','UNSOLD','CANCELLED') NOT NULL;
ALTER TABLE auctions ADD CONSTRAINT chk_auctions_result CHECK ((status IN ('UPCOMING','RUNNING') AND finished_at IS NULL) OR (status='SOLD' AND winner_user_id IS NOT NULL AND winning_price IS NOT NULL AND finished_at IS NOT NULL) OR (status IN ('UNSOLD','CANCELLED') AND winner_user_id IS NULL AND winning_price IS NULL AND finished_at IS NOT NULL));
