package com.group6.auction.livestream;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.sql.*;
import java.time.*;
import java.util.*;

@Service
@Profile("!probe")
@Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ, propagation=Propagation.REQUIRES_NEW)
public class LiveQueries {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final LivePresence presence;
    public LiveQueries(JdbcTemplate jdbc, Clock clock, LivePresence presence) { this.jdbc=jdbc; this.clock=clock; this.presence=presence; }
    static Long millis(ResultSet rs, String column) throws SQLException {
        var time=rs.getObject(column, LocalDateTime.class);
        return time==null?null:time.toInstant(ZoneOffset.UTC).toEpochMilli();
    }
    public List<Map<String,Object>> list() {
        return jdbc.queryForList("SELECT id FROM livestream_sessions ORDER BY starts_at DESC,id DESC LIMIT 100", Long.class)
                .stream().map(id -> session(id, false)).toList();
    }
    public Map<String,Object> session(long id, boolean room) {
        var rows=jdbc.query("""
                SELECT s.*,u.username FROM livestream_sessions s JOIN users u ON u.id=s.host_id WHERE s.id=?
                """, (rs,n) -> {
            Map<String,Object> value=new LinkedHashMap<>();
            value.put("id",rs.getString("id")); value.put("hostId",rs.getString("host_id")); value.put("hostName",rs.getString("username"));
            value.put("title",rs.getString("title")); value.put("description",rs.getString("description"));
            value.put("startsAt",millis(rs,"starts_at")); value.put("status",rs.getString("status"));
            value.put("currentLotIndex",rs.getInt("current_lot_index")); value.put("version",rs.getString("revision"));
            value.put("publisherReady",rs.getBoolean("publisher_ready")); value.put("mediaGeneration",rs.getString("media_generation"));
            value.put("remainingMs",rs.getObject("remaining_ms",Long.class)); value.put("pauseUntil",millis(rs,"pause_until"));
            return value;
        },id);
        if(rows.isEmpty()) throw new LiveException(404,"LIVE_NOT_FOUND","Không tìm thấy phiên livestream.");
        var value=rows.getFirst();
        var lots=jdbc.query("""
                SELECT l.id AS lot_id,l.phase,l.position,a.*,p.name,p.description,p.image_url,
                (SELECT b.amount FROM bids b WHERE b.auction_id=a.id ORDER BY b.amount DESC,b.id ASC LIMIT 1) AS current_amount,
                (SELECT b.user_id FROM bids b WHERE b.auction_id=a.id ORDER BY b.amount DESC,b.id ASC LIMIT 1) AS leader_id,
                (SELECT u.username FROM bids b JOIN users u ON u.id=b.user_id WHERE b.auction_id=a.id ORDER BY b.amount DESC,b.id ASC LIMIT 1) AS leader_name
                FROM livestream_lots l JOIN auctions a ON a.id=l.auction_id JOIN products p ON p.id=a.product_id
                WHERE l.session_id=? ORDER BY l.position
                """,(rs,n) -> {
            Map<String,Object> lot=new LinkedHashMap<>();
            lot.put("id",rs.getString("lot_id")); lot.put("auctionId",rs.getString("id")); lot.put("productId",rs.getString("product_id"));
            lot.put("name",rs.getString("name")); lot.put("description",Objects.requireNonNullElse(rs.getString("description"),""));
            lot.put("imageUrl",rs.getString("image_url")); lot.put("startingPrice",rs.getString("starting_price"));
            lot.put("currentPrice",Objects.requireNonNullElse(rs.getString("current_amount"),rs.getString("starting_price")));
            lot.put("leaderId",rs.getString("leader_id")); lot.put("leaderName",rs.getString("leader_name"));
            lot.put("status",rs.getString("phase")); lot.put("deadline",millis(rs,"end_time"));
            if(room && rs.getInt("position")==((Number)value.get("currentLotIndex")).intValue()) {
                lot.put("bids",jdbc.query("""
                        SELECT b.id,b.user_id,b.amount,b.created_at,u.username FROM bids b JOIN users u ON u.id=b.user_id
                        WHERE b.auction_id=? ORDER BY b.id DESC LIMIT 100
                        """,(bid,k) -> Map.of("id",bid.getString("id"),"userId",bid.getString("user_id"),
                        "username",bid.getString("username"),"amount",bid.getString("amount"),"at",millis(bid,"created_at")),rs.getLong("id")));
            } else lot.put("bids",List.of());
            return lot;
        },id);
        value.put("lots",lots);
        var clients=room?presence.room(id):List.<LivePresence.Client>of();
        var onlineIds=clients.stream().filter(c -> !c.host).map(c -> c.actor.userId()).collect(java.util.stream.Collectors.toSet());
        value.put("participants",room?jdbc.query("""
                SELECT p.user_id,p.seat_number,u.username FROM livestream_participants p JOIN users u ON u.id=p.user_id
                WHERE p.session_id=? ORDER BY p.seat_number
                """,(rs,n) -> Map.<String,Object>of("id",rs.getString("user_id"),"username",rs.getString("username"),
                "seatNumber",rs.getInt("seat_number")) ,id).stream().filter(p -> onlineIds.contains(Long.parseLong((String)p.get("id")))).toList():List.of());
        value.put("messages",room?jdbc.query("""
                SELECT c.id,c.user_id,c.content,c.sent_at,u.username FROM livestream_chat c JOIN users u ON u.id=c.user_id
                WHERE c.session_id=? ORDER BY c.id DESC LIMIT 100
                """,(rs,n) -> Map.<String,Object>of("id",rs.getString("id"),"userId",rs.getString("user_id"),
                "username",rs.getString("username"),"text",rs.getString("content"),"at",millis(rs,"sent_at")),id).reversed():List.of());
        value.put("connections",clients.stream().filter(c -> !c.host).map(c -> Map.of("id",c.connectionId,"userId",Long.toString(c.actor.userId()))).toList());
        var host=room?presence.host(id):null;
        value.put("hostConnectionId",host==null?null:host.connectionId);
        value.put("serverNow",clock.millis());
        return value;
    }
    public Map<String,Object> wallet(RealtimePrincipal actor) {
        if(actor.role()!=RealtimePrincipal.Role.USER) return null;
        var wallets=jdbc.query("SELECT available_balance,locked_balance FROM wallets WHERE user_id=? AND wallet_type='USER'",
                (rs,n) -> Map.<String,Object>of("availableBalance",rs.getString(1),"lockedBalance",rs.getString(2)),actor.userId());
        if(wallets.size()!=1) throw new LiveException(409,"WALLET_NOT_FOUND","Không tìm thấy ví cá nhân.");
        return wallets.getFirst();
    }
    public List<Map<String,Object>> purchases(RealtimePrincipal actor) {
        return jdbc.query("""
                SELECT l.id AS lot_id,l.session_id,a.id,a.product_id,a.winning_price,p.name FROM livestream_lots l
                JOIN auctions a ON a.id=l.auction_id JOIN products p ON p.id=a.product_id
                WHERE a.winner_user_id=? AND a.status='SOLD' ORDER BY a.finished_at DESC
                """,(rs,n) -> Map.of("id",rs.getString("id"),"sessionId",rs.getString("session_id"),"lotId",rs.getString("lot_id"),
                "userId",Long.toString(actor.userId()),"name",rs.getString("name"),"amount",rs.getString("winning_price"),"paid",true),actor.userId());
    }
    public Map<String,Object> state(RealtimePrincipal actor) {
        Map<String,Object> value=new LinkedHashMap<>();
        value.put("sessions",list()); value.put("orders",purchases(actor)); value.put("wallet",wallet(actor)); value.put("serverNow",clock.millis());
        value.put("registrations",jdbc.queryForList("SELECT session_id FROM livestream_registrations WHERE user_id=?",String.class,actor.userId()));
        value.put("notifications",jdbc.query("""
                SELECT n.session_id,s.title FROM livestream_notifications n JOIN livestream_sessions s ON s.id=n.session_id
                WHERE n.user_id=? AND s.status IN ('LIVE','PAUSED') ORDER BY n.created_at DESC
                """,(rs,n) -> Map.of("sessionId",rs.getString(1),"title",rs.getString(2)),actor.userId()));
        return value;
    }
    public Map<String,Object> snapshot(long id, RealtimePrincipal actor) {
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("session",session(id,true)); result.put("wallet",wallet(actor));
        result.put("orders",purchases(actor)); result.put("serverNow",clock.millis());
        return result;
    }
}
