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
                           LocalDateTime start, LocalDateTime end, long floor, long productId, int capacity) {}
    private record Round(LocalDateTime start, LocalDateTime tradeEnd, LocalDateTime bidLock, LocalDateTime end) {}
    private record Listing(long id, long clueId, long sellerId, long price, long version, boolean active) {}
    private record Bid(long id, long userId, long amount, LocalDateTime time) {}
    public record CatalogProduct(String name, String description, int quantity, String imageUrl) {}
    public record CatalogAuction(long id, CatalogProduct product, String access, String status,
                                 String startsAt, String endsAt, boolean joined, int participantCount, int capacity,
                                 boolean lobbyOpened) {}
    private boolean finished(String status) { return Set.of("SOLD","UNSOLD","CANCELLED").contains(status); }

    private LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).truncatedTo(java.time.temporal.ChronoUnit.MICROS); }
    private String iso(LocalDateTime value) { return value == null ? null : value.toInstant(ZoneOffset.UTC).toString(); }
    private BlindException missing() { return new BlindException(404, "AUCTION_NOT_FOUND"); }
    private Auction auction(long id, boolean lock) {
        if (id <= 0) throw missing();
        var rows = jdbc.query("SELECT id,auction_type,status,access_type,room_code,start_time,end_time,starting_price,product_id,max_participants FROM auctions WHERE id=?"+(lock?" FOR UPDATE":""),
            (rs,n)->new Auction(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),
                rs.getObject(6,LocalDateTime.class),rs.getObject(7,LocalDateTime.class),rs.getLong(8),rs.getLong(9),rs.getInt(10)),id);
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
        if(round(auctionId)!=null && !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM blind_clue_ownership WHERE auction_id=? AND user_id=?)",Boolean.class,auctionId,userId)))throw BlindException.forbidden("NOT_IN_ROUND");
    }
    private boolean opened(long auctionId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM blind_settings WHERE auction_id=? AND opened_at IS NOT NULL)",Boolean.class,auctionId));
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
    public List<CatalogAuction> catalog(String username) {
        long viewer=user(username);
        return jdbc.query("""
            SELECT a.id,a.access_type,a.status,a.start_time,a.end_time,
                   p.name,p.description,p.quantity,p.image_url,
                   CASE WHEN a.status='RUNNING' THEN EXISTS(SELECT 1 FROM blind_clue_ownership mine WHERE mine.auction_id=a.id AND mine.user_id=?) ELSE EXISTS(SELECT 1 FROM auction_participants mine WHERE mine.auction_id=a.id AND mine.user_id=?) END AS joined,
                   (SELECT COUNT(*) FROM auction_participants players WHERE players.auction_id=a.id) AS participant_count, a.max_participants AS capacity,
                   EXISTS(SELECT 1 FROM blind_settings bs WHERE bs.auction_id=a.id AND bs.opened_at IS NOT NULL) AS lobby_opened
            FROM auctions a JOIN products p ON p.id=a.product_id
            WHERE a.auction_type='BLIND' AND (a.access_type='PUBLIC' OR a.status<>'UPCOMING' OR EXISTS(SELECT 1 FROM blind_settings bs WHERE bs.auction_id=a.id AND bs.opened_at IS NOT NULL)) ORDER BY a.start_time DESC,a.id DESC
            """,(rs,n)->new CatalogAuction(rs.getLong("id"),
                finished(rs.getString("status"))
                    ? new CatalogProduct(rs.getString("name"),rs.getString("description"),rs.getInt("quantity"),rs.getString("image_url"))
                    : new CatalogProduct("Sản phẩm bí mật",null,0,rs.getString("image_url")),
                rs.getString("access_type"),rs.getString("status"),
                iso(rs.getObject("start_time",LocalDateTime.class)),iso(rs.getObject("end_time",LocalDateTime.class)),
                rs.getBoolean("joined"),rs.getInt("participant_count"),rs.getInt("capacity"),rs.getBoolean("lobby_opened")),viewer,viewer);
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
        result.put("status",a.status());result.put("participantCount",count);result.put("onlineCount",online);result.put("capacity",a.capacity());result.put("clueCount",jdbc.queryForObject("SELECT COUNT(*) FROM blind_clues WHERE auction_id=?",Long.class,id));
        result.put("opened",opened(id));
        result.put("scheduledStartAt",opened(id)?null:iso(a.start()));result.put("lobbyClosesAt",round(id)==null?iso(a.end()):null);
        result.put("canStartNow",false);
        return result;
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object saveSettings(long id,Integer tradeSeconds,Integer bidSeconds) {
        Auction a=auction(id,true);
        if(!"UPCOMING".equals(a.status())||opened(id)||round(id)!=null)
            throw BlindException.conflict("SETTINGS_NOT_EDITABLE");
        if(tradeSeconds==null||bidSeconds==null||tradeSeconds<1||tradeSeconds>3600||bidSeconds<1||bidSeconds>3600)
            throw BlindException.bad("INVALID_DURATION");
        jdbc.update("INSERT INTO blind_settings(auction_id,trade_seconds,bid_seconds) VALUES(?,?,?) ON DUPLICATE KEY UPDATE trade_seconds=VALUES(trade_seconds),bid_seconds=VALUES(bid_seconds)",id,tradeSeconds,bidSeconds);
        return adminSettings(id);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object saveClues(long id,List<String> contents) {
        Auction a=auction(id,true);
        if(!"UPCOMING".equals(a.status())||opened(id)||
           jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=?",Long.class,id)>0)
            throw BlindException.conflict("CLUES_NOT_EDITABLE");
        if(contents==null||contents.size()!=a.capacity()||contents.size()>30)throw BlindException.bad("CLUES_INSUFFICIENT");
        var cleaned=new ArrayList<String>();
        for(String raw:contents){
            if(raw==null||raw.strip().isEmpty()||raw.strip().length()>500)throw BlindException.bad("INVALID_CLUE");
            cleaned.add(raw.strip());
        }
        if(Set.copyOf(cleaned).size()!=cleaned.size())throw BlindException.bad("DUPLICATE_CLUE");
        jdbc.update("DELETE FROM blind_clues WHERE auction_id=?",id);
        for(int i=0;i<cleaned.size();i++)jdbc.update("INSERT INTO blind_clues(auction_id,slot,content) VALUES(?,?,?)",id,i+1,cleaned.get(i));
        return Map.of("clues",cleaned);
    }

    @Transactional(readOnly=true)
    public Object state(long id,String username) {
        Auction a=auction(id,false);long viewer=user(username);participant(id,viewer);
        Round r=round(id);LocalDateTime time=now();String phase;
        if("SOLD".equals(a.status())||"UNSOLD".equals(a.status())||"CANCELLED".equals(a.status()))phase="FINISHED";
        else if(r==null)phase="WAITING";
        else if(time.isBefore(r.start().plusSeconds(REVEAL_SECONDS)))phase="REVEAL";
        else if(time.isBefore(r.tradeEnd()))phase="TRADE";
        else if(time.isBefore(r.tradeEnd().plusSeconds(DISCUSS_SECONDS)))phase="DISCUSS";
        else if(time.isBefore(r.bidLock()))phase="BID";
        else if(time.isBefore(r.end()))phase="LOCKED";
        else phase="SETTLING";
        Map<String,Object> product;
        if("FINISHED".equals(phase))product=jdbc.queryForMap("SELECT p.name,p.description,p.image_url FROM products p WHERE p.id=?",a.productId());
        else {product=new LinkedHashMap<>();product.put("name","Sản phẩm bí mật");product.put("description",null);product.put("image_url",jdbc.queryForObject("SELECT image_url FROM products WHERE id=?",String.class,a.productId()));}
        var owned=jdbc.query("SELECT c.id,c.slot,c.content,o.acquired_at FROM blind_clue_ownership o JOIN blind_clues c ON c.id=o.clue_id WHERE o.auction_id=? AND o.user_id=? ORDER BY c.slot",
            (rs,n)->Map.of("id",rs.getString(1),"slot",rs.getInt(2),"content",rs.getString(3),"verified",true,"acquiredAt",iso(rs.getObject(4,LocalDateTime.class))),id,viewer);
        var listings=jdbc.query("SELECT l.id,l.clue_id,l.seller_id,u.username,l.price,l.version,c.slot FROM blind_clue_listings l JOIN users u ON u.id=l.seller_id JOIN blind_clues c ON c.id=l.clue_id WHERE l.auction_id=? AND l.active=1 ORDER BY l.id",
            (rs,n)->Map.of("id",rs.getString(1),"clueId",rs.getString(2),"sellerId",rs.getString(3),"seller",rs.getString(4),"price",rs.getString(5),"version",rs.getString(6),"slot",rs.getInt(7)),id);
        var bids=jdbc.query("SELECT id,amount,created_at FROM bids WHERE auction_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
            (rs,n)->Map.of("id",rs.getString(1),"amount",rs.getString(2),"at",iso(rs.getObject(3,LocalDateTime.class))),id,viewer);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("auctionId",Long.toString(id));result.put("phase",phase);result.put("status",a.status());result.put("serverNow",iso(time));
        result.put("capacity",a.capacity());
        result.put("participantCount",jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=?",Long.class,id));
        result.put("onlineCount",membership.sessionIdsForAuction(id).stream()
            .map(sessions::principalForSessionId).filter(java.util.Optional::isPresent)
            .map(p->p.orElseThrow().userId()).distinct().count());
        result.put("product",product);result.put("ownedClues",owned);result.put("listings",listings);
        result.put("hasListedClue",jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM blind_clue_listings WHERE auction_id=? AND seller_id=?)",Boolean.class,id,viewer));
        result.put("soldClueIds",jdbc.query("SELECT DISTINCT clue_id FROM blind_clue_trades WHERE auction_id=?",(rs,n)->rs.getString(1),id));
        result.put("ownBid",bids.isEmpty()?null:bids.getFirst());
        result.put("revealEndsAt",r==null?null:iso(r.start().plusSeconds(REVEAL_SECONDS)));
        result.put("scheduledStartAt",null);
        result.put("lobbyClosesAt",r==null?iso(a.end()):null);
        result.put("tradeEndsAt",r==null?null:iso(r.tradeEnd()));
        result.put("bidStartsAt",r==null?null:iso(r.tradeEnd().plusSeconds(DISCUSS_SECONDS)));
        result.put("bidLocksAt",r==null?null:iso(r.bidLock()));
        result.put("endsAt",r==null?null:iso(r.end()));
        if("FINISHED".equals(phase)) {
            var outcome=jdbc.query("SELECT status,winner_user_id,winning_price,finished_at FROM auctions WHERE id=?",
                (rs,n)->{Map<String,Object> values=new LinkedHashMap<>();values.put("status",rs.getString(1));values.put("winnerUserId",rs.getString(2));values.put("winningPrice",rs.getString(3));values.put("finishedAt",iso(rs.getObject(4,LocalDateTime.class)));return values;},id).getFirst();
            result.put("result",outcome);
            result.put("topBids",jdbc.query("""
                SELECT u.id,u.username,latest.amount,latest.created_at FROM (
                  SELECT b.*,ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.created_at DESC,b.id DESC) AS revision
                  FROM bids b WHERE b.auction_id=?
                ) latest JOIN users u ON u.id=latest.user_id WHERE latest.revision=1
                ORDER BY latest.amount DESC,latest.created_at ASC,latest.id ASC LIMIT 3
                """,(rs,n)->Map.of("userId",rs.getString(1),"username",rs.getString(2),"amount",rs.getString(3),"at",iso(rs.getObject(4,LocalDateTime.class))),id));
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
        if(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM blind_clue_trades WHERE auction_id=? AND clue_id=?)",Boolean.class,auctionId,clueId))
            throw BlindException.conflict("CLUE_ALREADY_SOLD");
        var previous=jdbc.query("SELECT clue_id,active FROM blind_clue_listings WHERE auction_id=? AND seller_id=?",
            (rs,n)->new Object[]{rs.getLong(1),rs.getBoolean(2)},auctionId,seller);
        if(!previous.isEmpty()&&(previous.size()>1||(long)previous.getFirst()[0]!=clueId||!((boolean)previous.getFirst()[1])))
            throw BlindException.conflict("LISTING_LIMIT_REACHED");
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
        if(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM blind_clue_trades WHERE auction_id=? AND clue_id=?)",Boolean.class,auctionId,listing.clueId()))
            throw BlindException.conflict("CLUE_ALREADY_SOLD");
        if(listing.sellerId()==buyer||owns(auctionId,listing.clueId(),buyer))throw BlindException.conflict("CLUE_ALREADY_KNOWN");
        if(!owns(auctionId,listing.clueId(),listing.sellerId()))throw BlindException.conflict("SELLER_NO_LONGER_OWNS_CLUE");
        clueTransfers.transfer(auctionId,buyer,listing.sellerId(),listing.price());
        var time=now();
        jdbc.update("INSERT INTO blind_clue_ownership(auction_id,clue_id,user_id,acquired_at) VALUES(?,?,?,?)",auctionId,listing.clueId(),buyer,time);
        jdbc.update("INSERT INTO blind_clue_trades(auction_id,clue_id,listing_id,buyer_id,seller_id,price,created_at) VALUES(?,?,?,?,?,?,?)",
            auctionId,listing.clueId(),listing.id(),buyer,listing.sellerId(),listing.price(),time);
        jdbc.update("UPDATE blind_clue_listings SET active=0,version=version+1 WHERE auction_id=? AND clue_id=? AND active=1",auctionId,listing.clueId());
        return Map.of("status","PURCHASED","price",Long.toString(listing.price()));
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object bid(long auctionId,String username,String rawAmount) {
        Auction a=auction(auctionId,true);bidding(a);long bidder=user(username);participant(auctionId,bidder);
        long amount=positive(rawAmount);
        var previous=jdbc.queryForList("SELECT amount FROM bids WHERE auction_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1",Long.class,auctionId,bidder);
        if(!previous.isEmpty()&&amount==previous.getFirst())throw BlindException.conflict("BID_UNCHANGED");
        if(!previous.isEmpty()&&amount<previous.getFirst())wallets.releaseAll(auctionId,bidder);
        var key=new org.springframework.jdbc.support.GeneratedKeyHolder();
        var time=now();
        jdbc.update(connection->{var ps=connection.prepareStatement("INSERT INTO bids(auction_id,user_id,amount,created_at) VALUES(?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1,auctionId);ps.setLong(2,bidder);ps.setLong(3,amount);ps.setObject(4,time);return ps;},key);
        long bidId=Objects.requireNonNull(key.getKey()).longValue();
        integration.blindBidAccepted(auctionId,bidId);
        return Map.of("id",Long.toString(bidId),"amount",Long.toString(amount),"at",iso(time));
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Object open(long auctionId) {
        Auction a=auction(auctionId,true);
        openLocked(a);
        return adminSettings(auctionId);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void openIfDue(long auctionId) {
        Auction a=auction(auctionId,true);
        if(!"UPCOMING".equals(a.status())||opened(auctionId)||now().isBefore(a.start()))return;
        openLocked(a);
    }
    private void openLocked(Auction a) {
        long auctionId=a.id();
        if(!"UPCOMING".equals(a.status())||opened(auctionId)||
           jdbc.queryForObject("SELECT COUNT(*) FROM auction_participants WHERE auction_id=?",Long.class,auctionId)>0)
            throw BlindException.conflict("LOBBY_NOT_OPENABLE");
        long clues=jdbc.queryForObject("SELECT COUNT(*) FROM blind_clues WHERE auction_id=?",Long.class,auctionId);
        if(clues!=a.capacity())throw BlindException.conflict("CLUES_INSUFFICIENT");
        LocalDateTime time=now();
        jdbc.update("INSERT INTO blind_settings(auction_id,trade_seconds,bid_seconds) VALUES(?,300,100) ON DUPLICATE KEY UPDATE auction_id=auction_id",auctionId);
        jdbc.update("UPDATE auctions SET start_time=?,end_time=? WHERE id=?",time,time.plusMinutes(5),auctionId);
        jdbc.update("UPDATE blind_settings SET opened_at=? WHERE auction_id=?",time,auctionId);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void startIfReady(long auctionId) {
        Auction a=auction(auctionId,true); LocalDateTime time=now();
        if(!"UPCOMING".equals(a.status())||!opened(auctionId))return;
        var reserved=jdbc.queryForList("SELECT user_id FROM auction_participants WHERE auction_id=? ORDER BY user_id",Long.class,auctionId);
        var online=membership.sessionIdsForAuction(auctionId).stream()
            .map(sessions::principalForSessionId).filter(java.util.Optional::isPresent)
            .map(p->p.orElseThrow().userId()).distinct().filter(reserved::contains).sorted().toList();
        boolean expired=!time.isBefore(a.end());
        if((!expired&&(reserved.size()!=a.capacity()||online.size()!=a.capacity()))||
           (expired&&online.size()<3))return;
        var clues=jdbc.queryForList("SELECT id FROM blind_clues WHERE auction_id=? ORDER BY slot",Long.class,auctionId);
        if(clues.size()!=a.capacity())return;
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
        for(int i=0;i<online.size();i++)jdbc.update("INSERT INTO blind_clue_ownership(auction_id,clue_id,user_id,acquired_at) VALUES(?,?,?,?)",auctionId,clues.get(i),online.get(i),time);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void expireUnfilled(long auctionId) {
        Auction a=auction(auctionId,true);LocalDateTime time=now();
        if("UPCOMING".equals(a.status())&&opened(auctionId)&&!time.isBefore(a.end()))
            jdbc.update("UPDATE auctions SET status='CANCELLED',finished_at=? WHERE id=?",time,auctionId);
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
