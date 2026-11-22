package com.group6.auction.livestream;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Final-round policy; callers hold the session lock in LiveService. */
@Service @Profile("!probe")
@Transactional(propagation=Propagation.MANDATORY)
public class LiveFinalService {
    private final JdbcTemplate db;
    public LiveFinalService(JdbcTemplate db) { this.db=db; }
    public boolean secret(long sessionId,long lotId) {
        return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_lots WHERE session_id=? AND id=? AND lot_kind='SECRET')",Boolean.class,sessionId,lotId));
    }
    public boolean reveal(long sessionId) {
        return db.update("""
            UPDATE livestream_sessions s SET final_state='REVEALED'
            WHERE s.id=? AND s.mystery_enabled=TRUE AND s.final_state='LOCKED' AND s.status IN ('LIVE','PAUSED')
            AND EXISTS(SELECT 1 FROM livestream_tickets t WHERE t.session_id=s.id)
            AND EXISTS(SELECT 1 FROM livestream_lots l WHERE l.session_id=s.id AND l.lot_kind='REGULAR')
            AND NOT EXISTS(SELECT 1 FROM livestream_lots l WHERE l.session_id=s.id AND l.lot_kind='REGULAR' AND l.phase<>'SOLD')
            """,sessionId)>0;
    }
    public void requireReady(long sessionId,long lotId,boolean bidding) {
        if(!secret(sessionId,lotId))return;
        String state=db.queryForObject("SELECT final_state FROM livestream_sessions WHERE id=?",String.class,sessionId);
        boolean ready=(bidding?"OPEN":"REVEALED").equals(state)
            && Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_tickets WHERE session_id=?)",Boolean.class,sessionId))
            && Boolean.FALSE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_lots WHERE session_id=? AND lot_kind='REGULAR' AND phase<>'SOLD')",Boolean.class,sessionId));
        if(!ready)throw LiveException.conflict("Chỉ mở món bí mật sau khi bán hết hàng thường và có người nhận vé.");
    }
    public void requireTicket(long sessionId,long lotId,long userId) {
        if(!secret(sessionId,lotId))return;
        requireReady(sessionId,lotId,true);
        if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_tickets WHERE session_id=? AND user_id=?)",Boolean.class,sessionId,userId)))
            throw new LiveException(403,"TICKET_REQUIRED","Chỉ người có vé của phiên này được đặt giá vòng cuối.");
    }
    public void opened(long sessionId,long lotId) {
        if(secret(sessionId,lotId))db.update("UPDATE livestream_sessions SET final_state='OPEN' WHERE id=?",sessionId);
    }
    public void sold(long sessionId,long lotId) {
        if(secret(sessionId,lotId))db.update("UPDATE livestream_sessions SET final_state='SOLD' WHERE id=?",sessionId);
        else reveal(sessionId);
    }
    public void unsold(long lotId) {
        db.update("""
            UPDATE livestream_sessions s JOIN livestream_lots l ON l.session_id=s.id
            SET s.final_state='REVEALED' WHERE l.id=? AND l.lot_kind='SECRET' AND s.final_state='OPEN'
            """,lotId);
    }
    public void ended(long sessionId) {
        // REVEALED is retained for a revealed-but-unsold product; SKIPPED stays secret forever.
        db.update("UPDATE livestream_sessions SET final_state='SKIPPED' WHERE id=? AND mystery_enabled=TRUE AND final_state='LOCKED'",sessionId);
    }
}
