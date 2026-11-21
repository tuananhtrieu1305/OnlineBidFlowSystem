package com.group6.auction.livestream;

import com.group6.auction.realtime.connection.*;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.product.service.ProductVersion;
import com.group6.auction.wallet.service.WalletQueryService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.socket.WebSocketSession;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class LiveIT {
 @Autowired com.group6.auction.realtime.replay.JpaReplayDataGateway replay;
 @Autowired com.group6.auction.realtime.room.JpaRoomDataGateway legacyRooms;
 @Autowired LiveService service; @Autowired LiveQueries queries; @Autowired LivePresence presence;
 @Autowired JdbcTemplate db; @Autowired ProductRepository products; @Autowired WalletQueryService wallets;
 @org.springframework.boot.test.mock.mockito.SpyBean com.group6.auction.wallet.service.WalletTransferService transfers;
 @MockBean Clock clock; @MockBean LiveScheduler scheduler;
 long now=System.currentTimeMillis(),host,user1,user2,id,lot,auction;
 LivePresence.Client publisher;
 RealtimePrincipal admin,a,b;
 String prefix="live_"+UUID.randomUUID().toString().substring(0,8);
 @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");}
 void at(long value){now=value;when(clock.millis()).thenAnswer(i->now);when(clock.instant()).thenAnswer(i->Instant.ofEpochMilli(now));when(clock.getZone()).thenReturn(ZoneOffset.UTC);}
 long user(String suffix,String role){String name=prefix+suffix;db.update("INSERT INTO users(username,password_hash,role) VALUES(?,'unused',?)",name,role);long u=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,name);if(role.equals("USER")){db.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES(?,'USER',0,0,UTC_TIMESTAMP(6))",u);wallets.deposit(name,1000);}return u;}
 LivePresence.Client connection(RealtimePrincipal actor)throws Exception {var socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn(UUID.randomUUID().toString());when(socket.isOpen()).thenReturn(true);return presence.register(socket,actor);}
 @BeforeEach void setup()throws Exception {
  at(now);host=user("h","ADMIN");user1=user("a","USER");user2=user("b","USER");admin=new RealtimePrincipal(host,prefix+"h",RealtimePrincipal.Role.ADMIN);a=new RealtimePrincipal(user1,prefix+"a",RealtimePrincipal.Role.USER);b=new RealtimePrincipal(user2,prefix+"b",RealtimePrincipal.Role.USER);
  db.update("INSERT INTO products(name,quantity) VALUES(?,1)",prefix);long p=db.queryForObject("SELECT id FROM products WHERE name=?",Long.class,prefix);
  var product=products.findById(p).orElseThrow();id=service.create(admin,new LiveInput.Create(UUID.randomUUID(),prefix,"",now+60000,List.of(new LiveInput.Lot(p,ProductVersion.of(product),"100"))));
  lot=db.queryForObject("SELECT id FROM livestream_lots WHERE session_id=?",Long.class,id);auction=db.queryForObject("SELECT auction_id FROM livestream_lots WHERE id=?",Long.class,lot);
  publisher=connection(admin);service.join(id,publisher);service.ready(id,publisher,true);service.join(id,connection(a));service.join(id,connection(b));command("start");command("open");
 }
 void command(String name){service.command(id,admin,name,new LiveInput.Command(UUID.randomUUID(),lot));}
 long available(long u){return db.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,u);}
 @AfterEach void cleanup(){long credit=db.queryForObject("SELECT COALESCE(SUM(t.available_delta),0) FROM coin_transactions t JOIN wallets w ON w.id=t.wallet_id WHERE t.auction_id=? AND w.wallet_type='SYSTEM'",Long.class,auction);db.update("UPDATE wallets SET available_balance=available_balance-? WHERE wallet_type='SYSTEM'",credit);for(var c:presence.all())presence.remove(c.socket.getId());db.update("DELETE FROM livestream_commands WHERE session_id=?",id);db.update("DELETE FROM livestream_chat WHERE session_id=?",id);db.update("DELETE FROM livestream_notifications WHERE session_id=?",id);db.update("DELETE FROM livestream_registrations WHERE session_id=?",id);db.update("DELETE FROM livestream_participants WHERE session_id=?",id);db.update("DELETE FROM livestream_lots WHERE session_id=?",id);db.update("DELETE FROM livestream_sessions WHERE id=?",id);db.update("DELETE FROM coin_transactions WHERE auction_id=? OR wallet_id IN (SELECT id FROM wallets WHERE user_id IN (?,?))",auction,user1,user2);db.update("DELETE FROM bids WHERE auction_id=?",auction);db.update("DELETE FROM auction_participants WHERE auction_id=?",auction);db.update("DELETE FROM auctions WHERE id=?",auction);db.update("DELETE FROM products WHERE name=?",prefix);db.update("DELETE FROM wallets WHERE user_id IN (?,?)",user1,user2);db.update("DELETE FROM users WHERE id IN (?,?,?)",host,user1,user2);}
 @Test void simultaneousEqualBidsSettleExactlyOnce()throws Exception {
  var gate=new CountDownLatch(1);try(var executor=Executors.newFixedThreadPool(2)){
   var tasks=List.of(a,b).stream().map(actor->executor.submit(()->{gate.await();try{service.bid(id,lot,actor,new LiveInput.Bid(UUID.randomUUID(),"101"));return true;}catch(LiveException e){return false;}})).toList();gate.countDown();assertThat(tasks.get(0).get()).isNotEqualTo(tasks.get(1).get());
  }
  assertThat(db.queryForObject("SELECT COUNT(*) FROM bids WHERE auction_id=?",Long.class,auction)).isEqualTo(1);
  at(now+5000);service.heartbeat(id,publisher);service.tick(id,false);service.tick(id,false);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Long.class,auction)).isEqualTo(2);
  assertThat(available(user1)+available(user2)).isEqualTo(1899);
 }
 @Test void replacesHoldAndResetsClockAndRetryIsIdempotent() {
  UUID request=UUID.randomUUID();service.bid(id,lot,a,new LiveInput.Bid(request,"100"));service.bid(id,lot,a,new LiveInput.Bid(request,"100"));assertThat(available(user1)).isEqualTo(900);
  at(now+1000);service.bid(id,lot,b,new LiveInput.Bid(UUID.randomUUID(),"109"));assertThat(available(user1)).isEqualTo(1000);assertThat(available(user2)).isEqualTo(891);
  assertThat(db.queryForObject("SELECT end_time FROM auctions WHERE id=?",LocalDateTime.class,auction)).isEqualTo(LocalDateTime.ofInstant(Instant.ofEpochMilli(now+5000),ZoneOffset.UTC));
  at(now+5000);service.heartbeat(id,publisher);assertThatThrownBy(()->service.bid(id,lot,a,new LiveInput.Bid(UUID.randomUUID(),"110"))).isInstanceOf(LiveException.class);service.tick(id,false);
 }
 @Test void disconnectFreezesAndExplicitResumeRestoresRemaining() {
  service.bid(id,lot,a,new LiveInput.Bid(UUID.randomUUID(),"100"));at(now+2000);service.disconnected(id,publisher.socket.getId());
  assertThat(queries.session(id,false).get("remainingMs")).isEqualTo(3000L);
  assertThatThrownBy(()->service.bid(id,lot,b,new LiveInput.Bid(UUID.randomUUID(),"101"))).isInstanceOf(LiveException.class);
  at(now+10000);service.join(id,publisher);service.ready(id,publisher,true);command("resume");
  assertThat(db.queryForObject("SELECT end_time FROM auctions WHERE id=?",LocalDateTime.class,auction)).isEqualTo(LocalDateTime.ofInstant(Instant.ofEpochMilli(now+3000),ZoneOffset.UTC));
 }
 @Test void timeoutRefundsAndRestartPauses() {
  service.bid(id,lot,a,new LiveInput.Bid(UUID.randomUUID(),"100"));at(now+1000);service.tick(id,true);assertThat(queries.session(id,false).get("status")).isEqualTo("PAUSED");
  at(now+300001);service.tick(id,false);assertThat(queries.session(id,false).get("status")).isEqualTo("ENDED");assertThat(available(user1)).isEqualTo(1000);assertThat(db.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("UNSOLD");
 }
 @Test void insufficientBalanceRollsBackBidAndHold() {
  assertThatThrownBy(()->service.bid(id,lot,a,new LiveInput.Bid(UUID.randomUUID(),"1001"))).isInstanceOf(com.group6.auction.wallet.service.WalletException.class);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM bids WHERE auction_id=?",Long.class,auction)).isZero();assertThat(available(user1)).isEqualTo(1000);
 }
 @Test void settlementRollbackLeavesHoldIntactAndRetryPaysOnce() {
  service.bid(id,lot,a,new LiveInput.Bid(UUID.randomUUID(),"100"));at(now+5000);service.heartbeat(id,publisher);
  doAnswer(call->{call.callRealMethod();throw new IllegalStateException("Injected failure after payment writes");}).doCallRealMethod().when(org.springframework.test.util.AopTestUtils.<com.group6.auction.wallet.service.WalletTransferService>getUltimateTargetObject(transfers)).settleAuction(auction,user1,100);
  assertThatThrownBy(()->service.tick(id,false)).isInstanceOf(IllegalStateException.class);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Long.class,auction)).isZero();
  assertThat(db.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("RUNNING");
  assertThat(available(user1)).isEqualTo(900);
  assertThatThrownBy(()->service.bid(id,lot,b,new LiveInput.Bid(UUID.randomUUID(),"101"))).isInstanceOf(LiveException.class);
  service.tick(id,false);assertThat(db.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Long.class,auction)).isEqualTo(2);
 }
 @Test void missedHeartbeatsFreezeAtLeaseExpiryAndPreserveSoldOnTimeout() {
  service.bid(id,lot,a,new LiveInput.Bid(UUID.randomUUID(),"100"));at(now+4000);service.tick(id,false);
  assertThat(queries.session(id,false).get("remainingMs")).isEqualTo(2000L);
  service.join(id,publisher);service.ready(id,publisher,true);command("resume");at(now+2000);service.heartbeat(id,publisher);service.tick(id,false);
  service.disconnected(id,publisher.socket.getId());at(now+300001);service.tick(id,false);
  assertThat(db.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("SOLD");assertThat(available(user1)).isEqualTo(900);
 } @Test void reservesInventoryAndExcludesLegacyRoomAndReplay() {
  long product=db.queryForObject("SELECT product_id FROM auctions WHERE id=?",Long.class,auction);
  assertThat(legacyRooms.findAuction(auction)).isEmpty();assertThat(replay.findAuction(auction)).isEmpty();
  assertThatThrownBy(()->com.group6.auction.product.service.ProductAvailability.requireAvailable(db,product,1)).isInstanceOf(com.group6.auction.auction.configuration.AuctionConfigurationException.class);
  command("end");com.group6.auction.product.service.ProductAvailability.requireAvailable(db,product,1);
 } @Test void createAndHostCommandRetriesReturnTheCommittedResult() {
  long product=db.queryForObject("SELECT product_id FROM auctions WHERE id=?",Long.class,auction);
  UUID request=UUID.fromString(db.queryForObject("SELECT create_request_id FROM livestream_sessions WHERE id=?",String.class,id));
  var input=new LiveInput.Create(request,prefix,"",now+60000,List.of(new LiveInput.Lot(product,ProductVersion.of(products.findById(product).orElseThrow()),"100")));
  assertThat(service.create(admin,input)).isEqualTo(id);
  assertThatThrownBy(()->service.create(admin,new LiveInput.Create(request,"Changed title","",input.startsAt(),input.lots()))).isInstanceOf(LiveException.class);
  var command=new LiveInput.Command(UUID.randomUUID(),lot);service.command(id,admin,"end",command);
  long revision=db.queryForObject("SELECT revision FROM livestream_sessions WHERE id=?",Long.class,id);service.command(id,admin,"end",command);
  assertThat(db.queryForObject("SELECT revision FROM livestream_sessions WHERE id=?",Long.class,id)).isEqualTo(revision);
 }}
