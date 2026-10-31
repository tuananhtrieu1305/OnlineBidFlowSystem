package com.group6.auction.auction.blind;

import com.group6.auction.auction.integration.AuctionWalletIntegration;
import com.group6.auction.realtime.connection.RealtimeSessionRegistry;
import com.group6.auction.realtime.room.RoomMembershipService;
import com.group6.auction.wallet.service.ClueTradeTransferService;
import com.group6.auction.wallet.service.WalletTransferService;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** All BLIND mutations lock the auction row first. This serializes bidding, trading and phase changes. */
@Service
@Profile("!probe")
public class BlindService {
    private static final int REVEAL_SECONDS = 20;
    private static final int DISCUSS_SECONDS = 60;
    private static final int BID_LOCK_SECONDS = 20;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ClueTradeTransferService clueTransfers;
    private final WalletTransferService wallets;
    private final AuctionWalletIntegration integration;
    private final RoomMembershipService membership;
    private final RealtimeSessionRegistry sessions;
    private final SecureRandom random = new SecureRandom();

    public BlindService(JdbcTemplate jdbc, Clock clock, ClueTradeTransferService clueTransfers,
                        WalletTransferService wallets, AuctionWalletIntegration integration,
                        RoomMembershipService membership, RealtimeSessionRegistry sessions) {
        this.jdbc = jdbc; this.clock = clock; this.clueTransfers = clueTransfers; this.wallets = wallets; this.integration = integration;
        this.membership = membership; this.sessions = sessions;
    }

    private record Auction(long id, String type, String status, String access, String code,
                           LocalDateTime start, LocalDateTime end, long floor, long productId) {}
    private record Round(LocalDateTime start, LocalDateTime tradeEnd, LocalDateTime bidLock, LocalDateTime end) {}
    private record Listing(long id, long clueId, long sellerId, long price, long version, boolean active) {}
    private record Bid(long id, long userId, long amount, LocalDateTime time) {}

    private LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).truncatedTo(java.time.temporal.ChronoUnit.MICROS); }
    private String iso(LocalDateTime value) { return value == null ? null : value.toInstant(ZoneOffset.UTC).toString(); }
    private BlindException missing() { return new BlindException(404, "AUCTION_NOT_FOUND"); }
    private Auction auction(long id, boolean lock) {
        if (id <= 0) throw missing();
        var rows = jdbc.query("SELECT id,auction_type,status,access_type,room_code,start_time,end_time,starting_price,product_id FROM auctions WHERE id=?"+(lock?" FOR UPDATE":""),
            (rs,n)->new Auction(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),
                rs.getObject(6,LocalDateTime.class),rs.getObject(7,LocalDateTime.class),rs.getLong(8),rs.getLong(9)),id);
        if (rows.size()!=1 || !"BLIND".equals(rows.getFirst().type())) throw missing();
        return rows.getFirst();
    }
    private long user(String name) {
        var ids=jdbc.queryForList("SELECT id FROM users WHERE username=? AND role='USER'",Long.class,name);
        if(ids.size()!=1)throw BlindException.forbidden("USER_REQUIRED");
        return ids.getFirst();
    }
    private void participant(long auctionId,long userId) {
        Long count=jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=? AND user_id=?",Long.class,auctionId,userId);
        if(count==null||count!=1)throw BlindException.forbidden("NOT_IN_ROOM");
    }
    private Round round(long auctionId) {
        var rows=jdbc.query("SELECT started_at,trade_ends_at,bid_locks_at,ends_at FROM blind_rounds WHERE auction_id=?",
            (rs,n)->new Round(rs.getObject(1,LocalDateTime.class),rs.getObject(2,LocalDateTime.class),
                rs.getObject(3,LocalDateTime.class),rs.getObject(4,LocalDateTime.class)),auctionId);
        return rows.isEmpty()?null:rows.getFirst();
    }
    private void trading(Auction auction) {
        var r=round(auction.id());var time=now();
        if(!"RUNNING".equals(auction.status())||r==null||time.isBefore(r.start().plusSeconds(REVEAL_SECONDS))||!time.isBefore(r.tradeEnd()))
            throw BlindException.conflict("CLUE_MARKET_CLOSED");
    }
    private void bidding(Auction auction) {
        var r=round(auction.id());var time=now();
        if(!"RUNNING".equals(auction.status())||r==null||time.isBefore(r.tradeEnd().plusSeconds(DISCUSS_SECONDS))||!time.isBefore(r.bidLock()))
            throw BlindException.conflict("BID_WINDOW_CLOSED");
    }
    private long positive(String value) {
        if(value==null||!value.matches("[1-9][0-9]{0,18}"))throw BlindException.bad("INVALID_AMOUNT");
        try {return Long.parseLong(value);}catch(NumberFormatException ex){throw BlindException.bad("INVALID_AMOUNT");}
    }
    private long id(String value) {
        if(value==null||!value.matches("[1-9][0-9]{0,18}"))throw BlindException.bad("INVALID_VERSION");
        try{return Long.parseLong(value);}catch(NumberFormatException ex){throw BlindException.bad("INVALID_VERSION");}
    }

    @Transactional(readOnly=true)
    public Object adminClues(long id) {
        auction(id,false);
        return Map.of("clues",jdbc.queryForList("SELECT content FROM blind_clues WHERE auction_id=? ORDER BY slot",String.class,id));
    }
    @Transactional(readOnly=true)
    public Object adminSettings(long id) {
        Auction a=auction(id,false);
        var durations=jdbc.query("SELECT trade_seconds,bid_seconds FROM blind_settings WHERE auction_id=?",
            (rs,n)->new int[]{rs.getInt(1),rs.getInt(2)},id);
        long count=jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=?",Long.class,id);
        long online=membership.sessionIdsForAuction(id).stream()
            .map(sessions::principalForSessionId).filter(java.util.Optional::isPresent)
            .map(p->p.orElseThrow().userId()).distinct().count();
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("tradeSeconds",durations.isEmpty()?300:durations.getFirst()[0]);
        result.put("bidSeconds",durations.isEmpty()?100:durations.getFirst()[1]);
        result.put("status",a.status());result.put("participantCount",count);result.put("onlineCount",online);
        result.put("scheduledStartAt",iso(a.start()));result.put("lobbyClosesAt",round(id)==null?iso(a.end()):null);
        result.put("canStartNow","UPCOMING".equals(a.status())&&count==4&&online==4&&now().isBefore(a.end())&&
            jdbc.queryForObject("SELECT COUNT(*) FROM blind_clues WHERE auction_id=?",Long.class,id)==4);
        return result;
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object saveSettings(long id,Integer tradeSeconds,Integer bidSeconds) {
        Auction a=auction(id,true);
        if(!"UPCOMING".equals(a.status())||!now().isBefore(a.end())||round(id)!=null)
            throw BlindException.conflict("SETTINGS_NOT_EDITABLE");
        if(tradeSeconds==null||bidSeconds==null||tradeSeconds<1||tradeSeconds>3600||bidSeconds<1||bidSeconds>3600)
            throw BlindException.bad("INVALID_DURATION");
        jdbc.update("INSERT INTO blind_settings(auction_id,trade_seconds,bid_seconds) VALUES(?,?,?) ON DUPLICATE KEY UPDATE trade_seconds=VALUES(trade_seconds),bid_seconds=VALUES(bid_seconds)",id,tradeSeconds,bidSeconds);
        return adminSettings(id);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object saveClues(long id,List<String> contents) {
        Auction a=auction(id,true);
        if(!"UPCOMING".equals(a.status())||!now().isBefore(a.start())||
           jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=?",Long.class,id)>0)
            throw BlindException.conflict("CLUES_NOT_EDITABLE");
        if(contents==null||contents.size()!=4)throw BlindException.bad("FOUR_CLUES_REQUIRED");
        var cleaned=new ArrayList<String>();
        for(String raw:contents){
            if(raw==null||raw.strip().isEmpty()||raw.strip().length()>500)throw BlindException.bad("INVALID_CLUE");
            cleaned.add(raw.strip());
        }
        if(Set.copyOf(cleaned).size()!=4)throw BlindException.bad("DUPLICATE_CLUE");
        jdbc.update("DELETE FROM blind_clues WHERE auction_id=?",id);
        for(int i=0;i<4;i++)jdbc.update("INSERT INTO blind_clues(auction_id,slot,content) VALUES(?,?,?)",id,i+1,cleaned.get(i));
        return Map.of("clues",cleaned);
    }

    @Transactional(readOnly=true)
    public Object state(long id,String username) {
        Auction a=auction(id,false);long viewer=user(username);participant(id,viewer);
        Round r=round(id);LocalDateTime time=now();String phase;
        if("SOLD".equals(a.status())||"UNSOLD".equals(a.status()))phase="FINISHED";
        else if(r==null)phase="WAITING";
        else if(time.isBefore(r.start().plusSeconds(REVEAL_SECONDS)))phase="REVEAL";
        else if(time.isBefore(r.tradeEnd()))phase="TRADE";
        else if(time.isBefore(r.tradeEnd().plusSeconds(DISCUSS_SECONDS)))phase="DISCUSS";
        else if(time.isBefore(r.bidLock()))phase="BID";
        else if(time.isBefore(r.end()))phase="LOCKED";
        else phase="SETTLING";
        var product=jdbc.queryForMap("SELECT p.name,p.description,p.image_url FROM products p WHERE p.id=?",a.productId());
        var owned=jdbc.query("SELECT c.id,c.slot,c.content,o.acquired_at FROM blind_clue_ownership o JOIN blind_clues c ON c.id=o.clue_id WHERE o.auction_id=? AND o.user_id=? ORDER BY c.slot",
            (rs,n)->Map.of("id",rs.getString(1),"slot",rs.getInt(2),"content",rs.getString(3),"verified",true,"acquiredAt",iso(rs.getObject(4,LocalDateTime.class))),id,viewer);
        var listings=jdbc.query("SELECT l.id,l.clue_id,l.seller_id,u.username,l.price,l.version,c.slot FROM blind_clue_listings l JOIN users u ON u.id=l.seller_id JOIN blind_clues c ON c.id=l.clue_id WHERE l.auction_id=? AND l.active=1 ORDER BY l.id",
            (rs,n)->Map.of("id",rs.getString(1),"clueId",rs.getString(2),"sellerId",rs.getString(3),"seller",rs.getString(4),"price",rs.getString(5),"version",rs.getString(6),"slot",rs.getInt(7)),id);
        var bids=jdbc.query("SELECT id,amount,created_at FROM bids WHERE auction_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
            (rs,n)->Map.of("id",rs.getString(1),"amount",rs.getString(2),"at",iso(rs.getObject(3,LocalDateTime.class))),id,viewer);
        var stats=jdbc.query("SELECT COUNT(*) AS soldCount,ROUND(AVG(winning_price),0) AS averagePrice,MIN(winning_price) AS minimumPrice,MAX(winning_price) AS maximumPrice FROM auctions WHERE product_id=? AND status='SOLD' AND finished_at<?",
            (rs,n)->{Map<String,Object> values=new LinkedHashMap<>();values.put("soldCount",rs.getLong(1));values.put("averagePrice",rs.getString(2));values.put("minimumPrice",rs.getString(3));values.put("maximumPrice",rs.getString(4));return values;},a.productId(),a.start()).getFirst();
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("auctionId",Long.toString(id));result.put("phase",phase);result.put("status",a.status());result.put("serverNow",iso(time));
        result.put("participantCount",jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=?",Long.class,id));
        result.put("onlineCount",membership.sessionIdsForAuction(id).stream()
            .map(sessions::principalForSessionId).filter(java.util.Optional::isPresent)
            .map(p->p.orElseThrow().userId()).distinct().count());
        result.put("product",product);result.put("ownedClues",owned);result.put("listings",listings);
        result.put("ownBid",bids.isEmpty()?null:bids.getFirst());result.put("historicalStats",stats);
        result.put("revealEndsAt",r==null?null:iso(r.start().plusSeconds(REVEAL_SECONDS)));
        result.put("scheduledStartAt",r==null?iso(a.start()):null);
        result.put("lobbyClosesAt",r==null?iso(a.end()):null);
        result.put("tradeEndsAt",r==null?null:iso(r.tradeEnd()));
        result.put("bidStartsAt",r==null?null:iso(r.tradeEnd().plusSeconds(DISCUSS_SECONDS)));
        result.put("bidLocksAt",r==null?null:iso(r.bidLock()));
        result.put("endsAt",r==null?null:iso(r.end()));
        if("FINISHED".equals(phase)) {
            var outcome=jdbc.query("SELECT status,winner_user_id,winning_price,finished_at FROM auctions WHERE id=?",
                (rs,n)->{Map<String,Object> values=new LinkedHashMap<>();values.put("status",rs.getString(1));values.put("winnerUserId",rs.getString(2));values.put("winningPrice",rs.getString(3));values.put("finishedAt",iso(rs.getObject(4,LocalDateTime.class)));return values;},id).getFirst();
            result.put("result",outcome);
        }
        return result;
    }

    private boolean owns(long auctionId,long clueId,long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM blind_clue_ownership WHERE auction_id=? AND clue_id=? AND user_id=?",Long.class,auctionId,clueId,userId)>0;
    }
    private Listing listing(long auctionId,long listingId) {
        var rows=jdbc.query("SELECT id,clue_id,seller_id,price,version,active FROM blind_clue_listings WHERE auction_id=? AND id=?",
            (rs,n)->new Listing(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getLong(4),rs.getLong(5),rs.getBoolean(6)),auctionId,listingId);
        if(rows.isEmpty())throw new BlindException(404,"LISTING_NOT_FOUND");
        return rows.getFirst();
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object list(long auctionId,long clueId,String username,String rawPrice) {
        Auction a=auction(auctionId,true);trading(a);long seller=user(username);participant(auctionId,seller);
        long price=positive(rawPrice);
        if(!owns(auctionId,clueId,seller))throw BlindException.forbidden("CLUE_NOT_OWNED");
        jdbc.update("INSERT INTO blind_clue_listings(auction_id,clue_id,seller_id,price,version,active) VALUES(?,?,?,?,1,1) ON DUPLICATE KEY UPDATE price=VALUES(price),version=version+1,active=1",
            auctionId,clueId,seller,price);
        return Map.of("status","LISTED");
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object cancel(long auctionId,long clueId,String username) {
        Auction a=auction(auctionId,true);trading(a);long seller=user(username);participant(auctionId,seller);
        if(jdbc.update("UPDATE blind_clue_listings SET active=0,version=version+1 WHERE auction_id=? AND clue_id=? AND seller_id=? AND active=1",auctionId,clueId,seller)!=1)
            throw BlindException.conflict("LISTING_NOT_ACTIVE");
        return Map.of("status","CANCELLED");
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object buy(long auctionId,long listingId,String username,String rawVersion) {
        Auction a=auction(auctionId,true);trading(a);long buyer=user(username);participant(auctionId,buyer);
        Listing listing=listing(auctionId,listingId);
        if(!listing.active()||listing.version()!=id(rawVersion))throw BlindException.conflict("LISTING_CHANGED");
        if(listing.sellerId()==buyer||owns(auctionId,listing.clueId(),buyer))throw BlindException.conflict("CLUE_ALREADY_KNOWN");
        if(!owns(auctionId,listing.clueId(),listing.sellerId()))throw BlindException.conflict("SELLER_NO_LONGER_OWNS_CLUE");
        clueTransfers.transfer(auctionId,buyer,listing.sellerId(),listing.price());
        var time=now();
        jdbc.update("INSERT INTO blind_clue_ownership(auction_id,clue_id,user_id,acquired_at) VALUES(?,?,?,?)",auctionId,listing.clueId(),buyer,time);
        jdbc.update("INSERT INTO blind_clue_trades(auction_id,clue_id,listing_id,buyer_id,seller_id,price,created_at) VALUES(?,?,?,?,?,?,?)",
            auctionId,listing.clueId(),listing.id(),buyer,listing.sellerId(),listing.price(),time);
        return Map.of("status","PURCHASED","price",Long.toString(listing.price()));
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object bid(long auctionId,String username,String rawAmount) {
        Auction a=auction(auctionId,true);bidding(a);long bidder=user(username);participant(auctionId,bidder);
        long amount=positive(rawAmount);
        var previous=jdbc.queryForList("SELECT amount FROM bids WHERE auction_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1",Long.class,auctionId,bidder);
        if(!previous.isEmpty()&&amount<previous.getFirst())wallets.releaseAll(auctionId,bidder);
        var key=new org.springframework.jdbc.support.GeneratedKeyHolder();
        var time=now();
        jdbc.update(connection->{var ps=connection.prepareStatement("INSERT INTO bids(auction_id,user_id,amount,created_at) VALUES(?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1,auctionId);ps.setLong(2,bidder);ps.setLong(3,amount);ps.setObject(4,time);return ps;},key);
        long bidId=Objects.requireNonNull(key.getKey()).longValue();
        integration.blindBidAccepted(auctionId,bidId);
        return Map.of("id",Long.toString(bidId),"amount",Long.toString(amount),"at",iso(time));
    }

    /** Called by the BLIND scheduler after the configured opening time. */
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void startIfReady(long auctionId) {
        start(auctionId,false);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object startNow(long auctionId) {
        start(auctionId,true);
        return adminSettings(auctionId);
    }
    private void start(long auctionId,boolean manual) {
        Auction a=auction(auctionId,true);LocalDateTime time=now();
        if(!"UPCOMING".equals(a.status())||(!manual&&time.isBefore(a.start()))||!time.isBefore(a.end())) {
            if(manual)throw BlindException.conflict("START_NOT_AVAILABLE");
            return;
        }
        var players=jdbc.queryForList("SELECT user_id FROM auction_participants WHERE auction_id=? ORDER BY user_id",Long.class,auctionId);
        if(players.size()!=4){if(manual)throw BlindException.conflict("FOUR_PLAYERS_REQUIRED");return;}
        long online=membership.sessionIdsForAuction(auctionId).stream()
            .map(sessions::principalForSessionId).filter(java.util.Optional::isPresent)
            .map(p->p.orElseThrow().userId()).distinct().filter(players::contains).count();
        if(online!=4){if(manual)throw BlindException.conflict("FOUR_PLAYERS_ONLINE_REQUIRED");return;}
        var clues=jdbc.queryForList("SELECT id FROM blind_clues WHERE auction_id=? ORDER BY slot",Long.class,auctionId);
        if(clues.size()!=4){if(manual)throw BlindException.conflict("FOUR_CLUES_REQUIRED");return;}
        Collections.shuffle(clues,random);
        var durations=jdbc.query("SELECT trade_seconds,bid_seconds FROM blind_settings WHERE auction_id=?",
            (rs,n)->new int[]{rs.getInt(1),rs.getInt(2)},auctionId);
        int tradeSeconds=durations.isEmpty()?300:durations.getFirst()[0];
        int bidSeconds=durations.isEmpty()?100:durations.getFirst()[1];
        LocalDateTime tradeEnd=time.plusSeconds(REVEAL_SECONDS+tradeSeconds);
        LocalDateTime bidStart=tradeEnd.plusSeconds(DISCUSS_SECONDS);
        LocalDateTime bidLock=bidStart.plusSeconds(bidSeconds),end=bidLock.plusSeconds(BID_LOCK_SECONDS);
        jdbc.update("UPDATE auctions SET status='RUNNING',start_time=?,end_time=? WHERE id=?",time,end,auctionId);
        jdbc.update("INSERT INTO blind_rounds(auction_id,started_at,trade_ends_at,bid_locks_at,ends_at) VALUES(?,?,?,?,?)",auctionId,time,tradeEnd,bidLock,end);
        for(int i=0;i<4;i++)jdbc.update("INSERT INTO blind_clue_ownership(auction_id,clue_id,user_id,acquired_at) VALUES(?,?,?,?)",auctionId,clues.get(i),players.get(i),time);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void expireUnfilled(long auctionId) {
        Auction a=auction(auctionId,true);LocalDateTime time=now();
        if("UPCOMING".equals(a.status())&&!time.isBefore(a.end()))
            jdbc.update("UPDATE auctions SET status='UNSOLD',finished_at=? WHERE id=?",time,auctionId);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void finishIfDue(long auctionId) {
        Auction a=auction(auctionId,true);Round r=round(auctionId);
        if(!"RUNNING".equals(a.status())||r==null||now().isBefore(r.end()))return;
        // One row per user: only the most recently confirmed revision competes.
        var bids=jdbc.query("""
            SELECT id,user_id,amount,created_at FROM (
              SELECT b.*,ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC,id DESC) AS revision
              FROM bids b WHERE auction_id=?
            ) latest WHERE revision=1 ORDER BY amount DESC,created_at ASC,id ASC LIMIT 1
            """,(rs,n)->new Bid(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getObject(4,LocalDateTime.class)),auctionId);
        if(!bids.isEmpty()&&bids.getFirst().amount()>=a.floor())
            integration.finishSold(auctionId,bids.getFirst().userId(),bids.getFirst().amount());
        else integration.finishUnsold(auctionId);
    }
}
