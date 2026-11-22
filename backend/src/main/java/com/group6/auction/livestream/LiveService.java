package com.group6.auction.livestream;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.product.service.*;
import com.group6.auction.wallet.service.WalletTransferService;
import com.group6.auction.auction.integration.AuctionWalletIntegration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.sql.*;
import java.time.*;
import java.util.*;

@Service @Profile("!probe")
@Transactional(isolation=Isolation.READ_COMMITTED)
public class LiveService {
    private final JdbcTemplate db; private final Clock clock; private final ProductRepository products;
    private final WalletTransferService wallets; private final AuctionWalletIntegration settlement;
    private final ApplicationEventPublisher events; private final LivePresence presence; private final LiveMissionService missions; private final LiveFinalService finals;
    public LiveService(JdbcTemplate db,Clock clock,ProductRepository products,WalletTransferService wallets,
                       AuctionWalletIntegration settlement,ApplicationEventPublisher events,LivePresence presence,LiveMissionService missions,LiveFinalService finals) {
        this.db=db;this.clock=clock;this.products=products;this.wallets=wallets;this.settlement=settlement;this.events=events;this.presence=presence;this.missions=missions;this.finals=finals;
    }
    private LocalDateTime time(long millis) { return LocalDateTime.ofInstant(Instant.ofEpochMilli(millis),ZoneOffset.UTC); }
    private long insert(String sql,Object... args) {
        var key=new GeneratedKeyHolder(); db.update(c->{var s=c.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS);for(int i=0;i<args.length;i++)s.setObject(i+1,args[i]);return s;},key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }
    private record Session(long id,long host,String status,int index,String socket,Long seen,boolean ready,Long remaining,Long pause) {}
    private record Lot(long id,long auction,String phase,Long deadline,long floor) {}
    private record Leader(long user,long amount) {}
    private Session lock(long id) {
        var rows=db.query("SELECT * FROM livestream_sessions WHERE id=? FOR UPDATE",(r,n)->new Session(id,r.getLong("host_id"),r.getString("status"),r.getInt("current_lot_index"),r.getString("host_socket_id"),LiveQueries.millis(r,"host_last_seen"),r.getBoolean("publisher_ready"),r.getObject("remaining_ms",Long.class),LiveQueries.millis(r,"pause_until")),id);
        if(rows.isEmpty())throw new LiveException(404,"LIVE_NOT_FOUND","Không tìm thấy phiên live.");return rows.getFirst();
    }
    private Lot lot(Session s) {
        var rows=db.query("SELECT l.id,l.auction_id,l.phase,a.end_time,a.starting_price FROM livestream_lots l JOIN auctions a ON a.id=l.auction_id WHERE l.session_id=? AND l.position=? FOR UPDATE",
                (r,n)->new Lot(r.getLong(1),r.getLong(2),r.getString(3),LiveQueries.millis(r,"end_time"),r.getLong(5)),s.id,s.index);
        if(rows.isEmpty())throw LiveException.conflict("Phiên không có sản phẩm hiện tại.");return rows.getFirst();
    }
    private Leader leader(Lot l) { var rows=db.query("SELECT user_id,amount FROM bids WHERE auction_id=? ORDER BY amount DESC,id LIMIT 1",(r,n)->new Leader(r.getLong(1),r.getLong(2)),l.auction);return rows.isEmpty()?null:rows.getFirst(); }
    private void owner(Session s,RealtimePrincipal a) { if(s.host!=a.userId())throw new LiveException(403,"HOST_REQUIRED","Chỉ host tạo phiên được điều khiển."); }
    private void changed(long id,String reason) { db.update("UPDATE livestream_sessions SET revision=revision+1 WHERE id=?",id);events.publishEvent(new LiveChanged(id,reason)); }
    private boolean healthy(Session s,long now) {return s.socket!=null&&s.seen!=null&&now<s.seen+3000&&presence.host(s.id)!=null;}
    private Long created(RealtimePrincipal actor,LiveInput.Create in) {
        var ids=db.queryForList("SELECT id FROM livestream_sessions WHERE host_id=? AND create_request_id=?",Long.class,actor.userId(),in.requestId().toString());
        if(ids.isEmpty())return null;
        long id=ids.getFirst();
        boolean same=db.queryForObject("SELECT title,description,starts_at FROM livestream_sessions WHERE id=?",(r,n)->r.getString(1).equals(in.title().strip())&&r.getString(2).equals(in.description().strip())&&Objects.equals(LiveQueries.millis(r,"starts_at"),in.startsAt()),id);
        var lots=db.query("SELECT a.product_id,a.starting_price FROM livestream_lots l JOIN auctions a ON a.id=l.auction_id WHERE l.session_id=? AND l.lot_kind='REGULAR' ORDER BY l.position",(r,n)->Map.entry(r.getLong(1),r.getString(2)),id);
        var requested=in.lots().stream().map(l->Map.entry(l.productId(),l.startingPrice())).toList();
        boolean sameMystery=Objects.equals(db.queryForObject("SELECT mystery_config FROM livestream_sessions WHERE id=?",String.class,id),LiveMysteryConfig.signature(in.mystery()));
        if(!same||!lots.equals(requested)||!sameMystery)throw LiveException.conflict("Mã yêu cầu đã được dùng để tạo phiên khác.");
        return id;
    }
    public long create(RealtimePrincipal actor,LiveInput.Create in) {
        if(actor.role()!=RealtimePrincipal.Role.ADMIN)throw new LiveException(403,"HOST_REQUIRED","Cần tài khoản Admin.");
        LiveMysteryConfig.validate(in);
        Long existing=created(actor,in);if(existing!=null)return existing;
        if(in.startsAt()<clock.millis()||LiveMysteryConfig.allLots(in).stream().map(LiveInput.Lot::productId).distinct().count()!=LiveMysteryConfig.allLots(in).size())throw LiveException.conflict("Lịch phát không hợp lệ hoặc trùng sản phẩm.");
        var locked=new ArrayList<com.group6.auction.product.entity.Product>();
        for(var item:LiveMysteryConfig.allLots(in).stream().sorted(Comparator.comparing(LiveInput.Lot::productId)).toList()) {
            LivePolicy.amount(item.startingPrice());
            var p=products.findForUpdate(item.productId()).orElseThrow(()->LiveException.conflict("Sản phẩm không tồn tại."));
            if(!ProductVersion.of(p).equals(item.productVersion()))throw LiveException.conflict("Sản phẩm đã thay đổi, hãy chọn lại.");
            locked.add(p);
        }
        existing=created(actor,in);if(existing!=null)return existing;
        for(var p:locked)ProductAvailability.requireAvailable(db,p.getId(),p.getQuantity());
        long id=insert("INSERT INTO livestream_sessions(host_id,create_request_id,title,description,starts_at) VALUES(?,?,?,?,?)",actor.userId(),in.requestId().toString(),in.title().strip(),in.description().strip(),time(in.startsAt()));
        if(in.mystery()!=null)db.update("UPDATE livestream_sessions SET mystery_enabled=TRUE,final_state='LOCKED',mystery_config=? WHERE id=?",LiveMysteryConfig.signature(in.mystery()),id);
        var lotIds=new HashMap<Long,Long>();
        int position=0;for(var item:LiveMysteryConfig.allLots(in)) {
            long auction=insert("INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,start_time,end_time,status) VALUES(?,?,'LIVESTREAM','PUBLIC',?,?,NULL,'UPCOMING')",item.productId(),actor.userId(),LivePolicy.amount(item.startingPrice()),time(in.startsAt()));
            long lotId=insert("INSERT INTO livestream_lots(session_id,auction_id,position,lot_kind) VALUES(?,?,?,?)",id,auction,position++,in.mystery()!=null&&item==in.mystery().secretLot()?"SECRET":"REGULAR");
            lotIds.put(item.productId(),lotId);
        }
        if(in.mystery()!=null) {
            int templatePosition=0;
            for(var mission:in.mystery().missions()) {
                long template=insert("INSERT INTO livestream_mission_templates(session_id,position,title) VALUES(?,?,?)",id,templatePosition++,mission.title().strip());
                for(var productId:mission.groupA())db.update("INSERT INTO livestream_mission_choices(template_id,group_key,lot_id) VALUES(?,'A',?)",template,lotIds.get(productId));
                for(var productId:mission.groupB())db.update("INSERT INTO livestream_mission_choices(template_id,group_key,lot_id) VALUES(?,'B',?)",template,lotIds.get(productId));
            }
        }
        changed(id,"CREATED");return id;
    }
    public void register(long id,RealtimePrincipal a,boolean registered) {
        Session s=lock(id);if(!s.status.equals("SCHEDULED"))throw LiveException.conflict("Phiên đã bắt đầu.");
        if(registered)db.update("INSERT IGNORE INTO livestream_registrations(session_id,user_id) VALUES(?,?)",id,a.userId());
        else db.update("DELETE FROM livestream_registrations WHERE session_id=? AND user_id=?",id,a.userId());
        changed(id,"REGISTERED");
    }
    public void join(long id,LivePresence.Client client) {
        Session s=lock(id);boolean host=s.host==client.actor.userId();
        // Resolve overdue sales/host lease before choosing the late viewer's available pair.
        if(!host&&client.actor.role()==RealtimePrincipal.Role.USER&&Boolean.TRUE.equals(db.queryForObject("SELECT mystery_enabled FROM livestream_sessions WHERE id=?",Boolean.class,id)))tick(id,false);
        presence.join(client,id,host);
        if(host) {
            if(s.status.equals("LIVE"))pause(s,clock.millis());
            db.update("UPDATE livestream_sessions SET host_socket_id=?,host_last_seen=?,publisher_ready=FALSE,media_generation=media_generation+1 WHERE id=?",client.socket.getId(),time(clock.millis()),id);
        } else {
            var seats=db.queryForList("SELECT seat_number FROM livestream_participants WHERE session_id=? AND user_id=?",Integer.class,id,client.actor.userId());
            if(seats.isEmpty()) { int seat=db.queryForObject("SELECT COALESCE(MAX(seat_number),0)+1 FROM livestream_participants WHERE session_id=?",Integer.class,id);db.update("INSERT INTO livestream_participants(session_id,user_id,seat_number) VALUES(?,?,?)",id,client.actor.userId(),seat); }
        }
        if(!host)missions.assign(id,client.actor);
        changed(id,"JOINED");
    }
    public void heartbeat(long id,LivePresence.Client c) {Session s=lock(id);owner(s,c.actor);if(!Objects.equals(s.socket,c.socket.getId()))throw LiveException.conflict("Kết nối host đã thay đổi.");db.update("UPDATE livestream_sessions SET host_last_seen=? WHERE id=?",time(clock.millis()),id);}
    public void ready(long id,LivePresence.Client c,boolean ready) {Session s=lock(id);owner(s,c.actor);if(!Objects.equals(s.socket,c.socket.getId()))throw LiveException.conflict("Kết nối host đã thay đổi.");if(!ready&&s.status.equals("LIVE"))pause(s,clock.millis());db.update("UPDATE livestream_sessions SET publisher_ready=? WHERE id=?",ready,id);changed(id,"MEDIA_READY");}
    public void disconnected(long id,String socket) {Session s=lock(id);if(Objects.equals(s.socket,socket)){if(s.status.equals("LIVE"))pause(s,clock.millis());db.update("UPDATE livestream_sessions SET host_socket_id=NULL,publisher_ready=FALSE WHERE id=?",id);changed(id,"HOST_LEFT");}else changed(id,"LEFT");}
    public void bid(long id,long lotId,RealtimePrincipal a,LiveInput.Bid in) {
        Session s=lock(id);Lot l=lot(s);long amount=LivePolicy.amount(in.amount());
        var prior=db.queryForList("SELECT b.amount FROM bids b JOIN livestream_lots lot ON lot.auction_id=b.auction_id WHERE lot.session_id=? AND lot.id=? AND b.user_id=? AND b.request_id=?",Long.class,id,lotId,a.userId(),in.requestId().toString());
        if(!prior.isEmpty()){if(prior.getFirst()!=amount)throw LiveException.conflict("Mã yêu cầu đã dùng cho giá khác.");return;}
        if(a.role()!=RealtimePrincipal.Role.USER||!presence.joined(id,a.userId()))throw new LiveException(403,"JOIN_REQUIRED","Hãy vào phòng bằng tài khoản người dùng.");
        if(l.id!=lotId||!s.status.equals("LIVE")||!l.phase.equals("OPEN")||!s.ready||!healthy(s,clock.millis()))throw LiveException.conflict("Lượt đấu chưa mở hoặc đang tạm dừng.");
        finals.requireTicket(id,l.id,a.userId());
        Leader previous=leader(l);LivePolicy.validateBid(l.floor,previous==null?null:previous.amount,amount,l.deadline==null?null:Instant.ofEpochMilli(l.deadline),clock.instant());
        db.update("INSERT IGNORE INTO auction_participants(auction_id,user_id,joined_at) VALUES(?,?,?)",l.auction,a.userId(),time(clock.millis()));
        insert("INSERT INTO bids(auction_id,user_id,amount,created_at,request_id) VALUES(?,?,?,?,?)",l.auction,a.userId(),amount,time(clock.millis()),in.requestId().toString());
        wallets.replaceLeader(l.auction,previous==null?null:previous.user,a.userId(),amount);
        // Wallet locks may wait: deadline must still be valid after all required locks are held.
        if(!healthy(s,clock.millis()))throw LiveException.conflict("Kết nối host đã gián đoạn. Chờ phiên tiếp tục.");
        LivePolicy.validateBid(l.floor,previous==null?null:previous.amount,amount,l.deadline==null?null:Instant.ofEpochMilli(l.deadline),clock.instant());
        db.update("UPDATE auctions SET end_time=? WHERE id=?",time(clock.millis()+5000),l.auction);changed(id,"BID_ACCEPTED");
    }
    private void sold(Session s,Lot l) {Leader winner=leader(l);if(winner==null)return;settlement.finishSold(l.auction,winner.user,winner.amount);db.update("UPDATE livestream_lots SET phase='SOLD' WHERE id=?",l.id);missions.afterPaid(s.id,winner.user);finals.sold(s.id,l.id);changed(s.id,"LOT_SOLD");}
    private void unsold(Lot l) {if(l.phase.equals("SOLD")||l.phase.equals("UNSOLD"))return;if(l.phase.equals("OPEN"))settlement.finishUnsold(l.auction);else db.update("UPDATE auctions SET status='UNSOLD',finished_at=? WHERE id=?",time(clock.millis()),l.auction);db.update("UPDATE livestream_lots SET phase='UNSOLD' WHERE id=?",l.id);finals.unsold(l.id);}
    private void pause(Session s,long at) {
        Lot l=lot(s);if(l.phase.equals("OPEN")&&l.deadline!=null&&l.deadline<=at)sold(s,l);
        Long remaining=l.phase.equals("OPEN")&&l.deadline!=null?Math.max(0,l.deadline-at):null;
        db.update("UPDATE livestream_sessions SET status='PAUSED',remaining_ms=?,pause_until=?,publisher_ready=FALSE WHERE id=?",remaining,time(at+300000),s.id);changed(s.id,"PAUSED");
    }
    public void command(long id,RealtimePrincipal a,String command,LiveInput.Command in) {
        Session s=lock(id);owner(s,a);
        var prior=db.queryForList("SELECT command,lot_id FROM livestream_commands WHERE session_id=? AND user_id=? AND request_id=?",id,a.userId(),in.requestId().toString());
        if(!prior.isEmpty()){Object recorded=prior.getFirst().get("lot_id");Long recordedId=recorded==null?null:Long.valueOf(recorded.toString());if(!command.equals(prior.getFirst().get("command"))||!Objects.equals(in.lotId(),recordedId))throw LiveException.conflict("Mã yêu cầu bị dùng lại.");return;}
        Lot l=lot(s);
        if(command.equals("select")||command.equals("reopen")) {
            if(in.lotId()!=null)finals.requireReady(id,in.lotId(),false);
        } else if(command.equals("open")||command.equals("start"))finals.requireReady(id,l.id,false);
        if(command.equals("reopen")&&in.lotId()!=null&&in.lotId()!=l.id) {
            if(l.phase.equals("OPEN")&&leader(l)!=null)throw LiveException.conflict("Chờ chốt sản phẩm hiện tại.");
            var positions=db.queryForList("SELECT position FROM livestream_lots WHERE session_id=? AND id=? AND phase='UNSOLD'",Integer.class,id,in.lotId());
            if(positions.isEmpty())throw LiveException.conflict("Món không thuộc phiên hoặc đã bán.");
            if(l.phase.equals("PRESENTING")||l.phase.equals("OPEN"))unsold(l);
            db.update("UPDATE livestream_sessions SET current_lot_index=? WHERE id=?",positions.getFirst(),id);
            s=lock(id);l=lot(s);
        }
        if(!command.equals("select")&&in.lotId()!=null&&in.lotId()!=l.id)throw LiveException.conflict("Sản phẩm đã chuyển, hãy tải lại phòng.");
        if(s.status.equals("ENDED"))throw LiveException.conflict("Phiên đã kết thúc.");
        switch(command) {
            case "select" -> selectLot(s,l,in.lotId());
            case "start" -> {if(!s.status.equals("SCHEDULED")||!s.ready||!healthy(s,clock.millis()))throw LiveException.conflict("Host cần kết nối và bật camera trước khi phát.");db.update("UPDATE livestream_sessions SET status='LIVE' WHERE id=?",id);db.update("UPDATE livestream_lots SET phase='PRESENTING' WHERE id=?",l.id);db.update("INSERT IGNORE INTO livestream_notifications(session_id,user_id,created_at) SELECT session_id,user_id,? FROM livestream_registrations WHERE session_id=?",time(clock.millis()),id);}
            case "resume" -> {if(!s.status.equals("PAUSED")||s.pause==null||s.pause<=clock.millis()||!s.ready||!healthy(s,clock.millis()))throw LiveException.conflict("Kiểm tra camera và kết nối trước khi tiếp tục.");if(l.phase.equals("OPEN")&&s.remaining!=null)db.update("UPDATE auctions SET end_time=? WHERE id=?",time(clock.millis()+s.remaining),l.auction);db.update("UPDATE livestream_sessions SET status='LIVE',remaining_ms=NULL,pause_until=NULL WHERE id=?",id);}
            case "open" -> {if(!s.status.equals("LIVE")||!l.phase.equals("PRESENTING")||!healthy(s,clock.millis())||!s.ready)throw LiveException.conflict("Chưa thể mở đấu.");db.update("UPDATE auctions SET status='RUNNING',start_time=?,end_time=NULL WHERE id=?",time(clock.millis()),l.auction);db.update("UPDATE livestream_lots SET phase='OPEN' WHERE id=?",l.id);finals.opened(id,l.id);}
            case "next" -> {if(!s.status.equals("LIVE")||l.phase.equals("OPEN")&&leader(l)!=null)throw LiveException.conflict("Chờ server chốt lượt đang đấu.");var next=db.queryForList("SELECT position FROM livestream_lots WHERE session_id=? AND phase='QUEUED' AND (lot_kind='REGULAR' OR EXISTS(SELECT 1 FROM livestream_sessions s WHERE s.id=livestream_lots.session_id AND s.final_state='REVEALED')) ORDER BY position LIMIT 1",Integer.class,id);if(next.isEmpty())throw LiveException.conflict("Đã đến sản phẩm cuối.");finals.requireReady(id,lot(new Session(s.id,s.host,s.status,next.getFirst(),s.socket,s.seen,s.ready,s.remaining,s.pause)).id,false);unsold(l);db.update("UPDATE livestream_sessions SET current_lot_index=? WHERE id=?",next.getFirst(),id);db.update("UPDATE livestream_lots SET phase='PRESENTING' WHERE session_id=? AND position=?",id,next.getFirst());}
            case "reopen" -> {if(!s.status.equals("LIVE")||!l.phase.equals("UNSOLD"))throw LiveException.conflict("Chỉ đấu lại món chưa bán.");db.update("UPDATE auctions SET status='UPCOMING',finished_at=NULL,end_time=NULL WHERE id=?",l.auction);db.update("UPDATE livestream_lots SET phase='PRESENTING' WHERE id=?",l.id);}
            case "end" -> {if(l.phase.equals("OPEN")&&leader(l)!=null)throw LiveException.conflict("Chờ chốt sản phẩm đang có người dẫn đầu.");end(s);}
            default -> throw new LiveException(400,"INVALID_COMMAND","Lệnh không hợp lệ.");
        }
        db.update("INSERT INTO livestream_commands(session_id,user_id,request_id,command,lot_id) VALUES(?,?,?,?,?)",id,a.userId(),in.requestId().toString(),command,in.lotId());changed(id,"COMMAND");
    }
    private void selectLot(Session s,Lot current,Long targetId) {
        if(!Set.of("SCHEDULED","LIVE").contains(s.status))throw LiveException.conflict("Tiếp tục phiên trước khi chọn sản phẩm.");
        if(targetId==null)throw new LiveException(400,"LOT_REQUIRED","Hãy chọn sản phẩm muốn đưa lên.");
        if(current.phase.equals("OPEN")&&leader(current)!=null)throw LiveException.conflict("Chờ chốt sản phẩm đang có người dẫn đầu.");
        var positions=db.queryForList("SELECT position FROM livestream_lots WHERE session_id=? AND id=? AND phase IN ('QUEUED','UNSOLD')",Integer.class,s.id,targetId);
        if(positions.isEmpty())throw LiveException.conflict("Chỉ chọn món chờ đấu hoặc chưa bán trong phiên này.");
        int position=positions.getFirst();
        if(targetId==current.id)return;
        Lot target=lot(new Session(s.id,s.host,s.status,position,s.socket,s.seen,s.ready,s.remaining,s.pause));
        // An item that has only been introduced stays available for a later selection.
        if(current.phase.equals("PRESENTING"))db.update("UPDATE livestream_lots SET phase='QUEUED' WHERE id=?",current.id);
        else if(current.phase.equals("OPEN"))unsold(current);
        if(target.phase.equals("UNSOLD"))db.update("UPDATE auctions SET status='UPCOMING',finished_at=NULL,end_time=NULL WHERE id=?",target.auction);
        db.update("UPDATE livestream_sessions SET current_lot_index=? WHERE id=?",position,s.id);
        db.update("UPDATE livestream_lots SET phase=? WHERE id=?",s.status.equals("LIVE")?"PRESENTING":"QUEUED",target.id);
    }
    private void end(Session s) {for(int index:db.queryForList("SELECT position FROM livestream_lots WHERE session_id=? ORDER BY position",Integer.class,s.id)){unsold(lot(new Session(s.id,s.host,s.status,index,s.socket,s.seen,s.ready,s.remaining,s.pause)));}db.update("UPDATE livestream_sessions SET status='ENDED',publisher_ready=FALSE,remaining_ms=NULL,pause_until=NULL WHERE id=?",s.id);finals.ended(s.id);changed(s.id,"ENDED");}
    public void tick(long id,boolean restart) {Session s=lock(id);long now=clock.millis();if(s.status.equals("LIVE")){if(restart||!healthy(s,now))pause(s,Math.min(now,s.seen==null?now:s.seen+3000));else {Lot l=lot(s);if(l.phase.equals("OPEN")&&l.deadline!=null&&l.deadline<=now)sold(s,l);}}else if(s.status.equals("PAUSED")&&s.pause!=null&&s.pause<=now)end(s);if(finals.reveal(id))changed(id,"FINAL_REVEALED");}
    public void chat(long id,RealtimePrincipal a,LiveInput.Chat in) {lock(id);if(!presence.joined(id,a.userId()))throw new LiveException(403,"JOIN_REQUIRED","Hãy vào phòng trước khi chat.");var prior=db.queryForList("SELECT content FROM livestream_chat WHERE session_id=? AND user_id=? AND request_id=?",String.class,id,a.userId(),in.requestId().toString());if(!prior.isEmpty()){if(!prior.getFirst().equals(in.text().strip()))throw LiveException.conflict("Mã yêu cầu đã dùng.");return;}Long recent=db.queryForObject("SELECT COUNT(*) FROM livestream_chat WHERE session_id=? AND user_id=? AND sent_at>?",Long.class,id,a.userId(),time(clock.millis()-1000));if(recent>0)throw new LiveException(429,"CHAT_RATE_LIMIT","Vui lòng đợi một giây.");db.update("INSERT INTO livestream_chat(session_id,user_id,request_id,content,sent_at) VALUES(?,?,?,?,?)",id,a.userId(),in.requestId().toString(),in.text().strip(),time(clock.millis()));changed(id,"CHAT");}
}
