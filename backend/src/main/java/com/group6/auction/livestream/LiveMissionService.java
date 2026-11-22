package com.group6.auction.livestream;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service @Profile("!probe")
public class LiveMissionService {
    private final JdbcTemplate db;
    private final Clock clock;
    public LiveMissionService(JdbcTemplate db, Clock clock) { this.db=db; this.clock=clock; }

    // All writes share LiveService's session lock and settlement transaction.
    @Transactional(propagation=Propagation.MANDATORY)
    public void assign(long sessionId, RealtimePrincipal actor) {
        if(actor.role()!=RealtimePrincipal.Role.USER) return;
        var sessions=db.queryForList("SELECT mystery_enabled,status,final_state,host_id FROM livestream_sessions WHERE id=? FOR UPDATE",sessionId);
        if(sessions.isEmpty())return;
        var session=sessions.getFirst();
        if(!Boolean.TRUE.equals(session.get("mystery_enabled")) || Objects.equals(((Number)session.get("host_id")).longValue(),actor.userId()) ||
                !Set.of("SCHEDULED","LIVE").contains(session.get("status")) || !"LOCKED".equals(session.get("final_state")))return;
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_user_missions WHERE session_id=? AND user_id=?)",Boolean.class,sessionId,actor.userId())))return;
        var templates=db.queryForList("""
                SELECT t.id FROM livestream_mission_templates t
                WHERE t.session_id=? AND EXISTS (
                    SELECT 1 FROM livestream_mission_choices ca
                    JOIN livestream_lots la ON la.id=ca.lot_id
                    JOIN auctions aa ON aa.id=la.auction_id
                    JOIN livestream_mission_choices cb ON cb.template_id=ca.template_id AND cb.group_key='B'
                    JOIN livestream_lots lb ON lb.id=cb.lot_id
                    JOIN auctions ab ON ab.id=lb.auction_id
                    WHERE ca.template_id=t.id AND ca.group_key='A' AND la.session_id=t.session_id AND lb.session_id=t.session_id
                    AND la.lot_kind='REGULAR' AND lb.lot_kind='REGULAR' AND aa.product_id<>ab.product_id
                    AND la.phase IN ('QUEUED','PRESENTING','OPEN','UNSOLD') AND lb.phase IN ('QUEUED','PRESENTING','OPEN','UNSOLD')
                ) ORDER BY t.position
                """,Long.class,sessionId);
        if(templates.isEmpty())return;
        long template=templates.get(ThreadLocalRandom.current().nextInt(templates.size()));
        db.update("INSERT INTO livestream_user_missions(session_id,user_id,template_id,assigned_at) VALUES(?,?,?,?)",
                sessionId,actor.userId(),template,Timestamp.from(clock.instant()));
    }

    private record Choice(String group, long product, String name, boolean paid) {}
    private List<Choice> choices(long sessionId, long template, long userId) {
        return db.query("""
                SELECT c.group_key,a.product_id,p.name,
                    (l.phase='SOLD' AND a.status='SOLD' AND a.winner_user_id=? AND EXISTS (
                        SELECT 1 FROM coin_transactions tx JOIN wallets w ON w.id=tx.wallet_id
                        WHERE tx.auction_id=a.id AND tx.transaction_type='PAYMENT' AND w.wallet_type='USER'
                        AND w.user_id=a.winner_user_id AND tx.available_delta=0 AND tx.locked_delta=-a.winning_price
                    )) AS paid
                FROM livestream_mission_choices c
                JOIN livestream_lots l ON l.id=c.lot_id JOIN auctions a ON a.id=l.auction_id
                JOIN products p ON p.id=a.product_id
                WHERE c.template_id=? AND l.session_id=? AND l.lot_kind='REGULAR' ORDER BY c.group_key,l.position
                """,(r,n)->new Choice(r.getString(1),r.getLong(2),r.getString(3),r.getBoolean(4)),userId,template,sessionId);
    }
    private int progress(List<Choice> choices) {
        var a=choices.stream().filter(c->c.paid&&c.group.equals("A")).map(Choice::product).toList();
        var b=choices.stream().filter(c->c.paid&&c.group.equals("B")).map(Choice::product).toList();
        if(a.stream().anyMatch(x->b.stream().anyMatch(y->!x.equals(y))))return 2;
        return a.isEmpty()&&b.isEmpty()?0:1;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void afterPaid(long sessionId, long userId) {
        if(!Boolean.TRUE.equals(db.queryForObject("SELECT mystery_enabled FROM livestream_sessions WHERE id=? FOR UPDATE",Boolean.class,sessionId)))return;
        var templates=db.queryForList("SELECT template_id FROM livestream_user_missions WHERE session_id=? AND user_id=?",Long.class,sessionId,userId);
        if(!templates.isEmpty()&&progress(choices(sessionId,templates.getFirst(),userId))==2)
            db.update("INSERT IGNORE INTO livestream_tickets(session_id,user_id,issued_at) VALUES(?,?,?)",sessionId,userId,Timestamp.from(clock.instant()));
    }
    // Called only by the actor-specific snapshot inside LiveQueries' read transaction.
    public Map<String,Object> personal(long sessionId, RealtimePrincipal actor, Map<String,Object> session) {
        if(actor.role()!=RealtimePrincipal.Role.USER || !Boolean.TRUE.equals(session.get("mysteryEnabled")) ||
                Long.toString(actor.userId()).equals(session.get("hostId")))return null;
        var templates=db.queryForList("SELECT template_id FROM livestream_user_missions WHERE session_id=? AND user_id=?",Long.class,sessionId,actor.userId());
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("sessionId",Long.toString(sessionId));result.put("userId",Long.toString(actor.userId()));
        result.put("version",session.get("version"));result.put("progress",0);result.put("ticket",false);
        if(templates.isEmpty()) {
            boolean joined=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_participants WHERE session_id=? AND user_id=?)",Boolean.class,sessionId,actor.userId()));
            result.put("status",!"LOCKED".equals(session.get("finalState")) || "ENDED".equals(session.get("status")) ? "CLOSED" : !joined || "PAUSED".equals(session.get("status")) ? "WAITING" : "UNAVAILABLE");
            return result;
        }
        long template=templates.getFirst();var choices=choices(sessionId,template,actor.userId());
        result.put("status","ASSIGNED");result.put("title",db.queryForObject("SELECT title FROM livestream_mission_templates WHERE id=? AND session_id=?",String.class,template,sessionId));
        result.put("progress",progress(choices));
        result.put("ticket",db.queryForObject("SELECT EXISTS(SELECT 1 FROM livestream_tickets WHERE session_id=? AND user_id=?)",Boolean.class,sessionId,actor.userId()));
        for(String group:List.of("A","B"))result.put("group"+group,choices.stream().filter(c->c.group.equals(group)).map(c->Map.<String,Object>of("productId",Long.toString(c.product),"name",c.name,"purchased",c.paid)).toList());
        return result;
    }
}
