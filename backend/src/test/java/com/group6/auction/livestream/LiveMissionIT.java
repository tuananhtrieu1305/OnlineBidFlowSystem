package com.group6.auction.livestream;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.product.service.ProductVersion;
import com.group6.auction.wallet.service.WalletQueryService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.socket.WebSocketSession;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class LiveMissionIT {
 @Autowired LiveService service; @Autowired LiveQueries queries; @Autowired LivePresence presence;
 @Autowired JdbcTemplate db; @Autowired ProductRepository products; @Autowired WalletQueryService wallets;
 @SpyBean LiveMissionService missions; @MockBean Clock clock; @MockBean LiveScheduler scheduler;
 long now=System.currentTimeMillis(), id, host, first, second;
 RealtimePrincipal admin,a,b; LivePresence.Client publisher;
 List<Long> productIds=new ArrayList<>(),lotIds,auctions;
 List<Long> extraUsers=new ArrayList<>();
 String prefix="mission_"+UUID.randomUUID().toString().substring(0,8);
 @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");}
 long user(String suffix,String role) {
  String name=prefix+suffix;db.update("INSERT INTO users(username,password_hash,role) VALUES(?,'unused',?)",name,role);
  long u=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,name);
  if(role.equals("USER")){db.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES(?,'USER',0,0,UTC_TIMESTAMP(6))",u);wallets.deposit(name,1000);}
  if(!List.of("a","b","h").contains(suffix))extraUsers.add(u);
  return u;
 }
 LivePresence.Client connection(RealtimePrincipal actor) throws Exception {
  var socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn(UUID.randomUUID().toString());when(socket.isOpen()).thenReturn(true);return presence.register(socket,actor);
 }
 @BeforeEach void setup() throws Exception {
  when(clock.millis()).thenAnswer(i->now);when(clock.instant()).thenAnswer(i->Instant.ofEpochMilli(now));when(clock.getZone()).thenReturn(ZoneOffset.UTC);
  host=user("h","ADMIN");first=user("a","USER");second=user("b","USER");
  admin=new RealtimePrincipal(host,prefix+"h",RealtimePrincipal.Role.ADMIN);a=new RealtimePrincipal(first,prefix+"a",RealtimePrincipal.Role.USER);b=new RealtimePrincipal(second,prefix+"b",RealtimePrincipal.Role.USER);
  var lots=new ArrayList<LiveInput.Lot>();
  for(int i=0;i<5;i++) {
   String name=prefix+i;db.update("INSERT INTO products(name,quantity) VALUES(?,1)",name);
   long p=db.queryForObject("SELECT id FROM products WHERE name=?",Long.class,name);productIds.add(p);
   lots.add(new LiveInput.Lot(p,ProductVersion.of(products.findById(p).orElseThrow()),"100"));
  }
  var template=new LiveInput.Mission("Buy two distinct items",List.of(productIds.get(0),productIds.get(2)),List.of(productIds.get(1),productIds.get(2)));
  id=service.create(admin,new LiveInput.Create(UUID.randomUUID(),prefix,"",now+60000,lots.subList(0,4),new LiveInput.Mystery(lots.get(4),List.of(template))));
  lotIds=db.queryForList("SELECT id FROM livestream_lots WHERE session_id=? ORDER BY position",Long.class,id);
  auctions=db.queryForList("SELECT auction_id FROM livestream_lots WHERE session_id=? ORDER BY position",Long.class,id);
  publisher=connection(admin);service.join(id,publisher);service.ready(id,publisher,true);
 }
 @AfterEach void cleanup() {
  for(var c:presence.all())presence.remove(c.socket.getId());
  for(long auction:auctions) {
   long credit=db.queryForObject("SELECT COALESCE(SUM(t.available_delta),0) FROM coin_transactions t JOIN wallets w ON w.id=t.wallet_id WHERE t.auction_id=? AND w.wallet_type='SYSTEM'",Long.class,auction);
   db.update("UPDATE wallets SET available_balance=available_balance-? WHERE wallet_type='SYSTEM'",credit);
   db.update("DELETE FROM coin_transactions WHERE auction_id=?",auction);db.update("DELETE FROM bids WHERE auction_id=?",auction);db.update("DELETE FROM auction_participants WHERE auction_id=?",auction);
  }
  for(String table:List.of("livestream_tickets","livestream_user_missions","livestream_commands","livestream_chat","livestream_notifications","livestream_registrations","livestream_participants"))db.update("DELETE FROM "+table+" WHERE session_id=?",id);
  db.update("DELETE c FROM livestream_mission_choices c JOIN livestream_mission_templates t ON t.id=c.template_id WHERE t.session_id=?",id);
  db.update("DELETE FROM livestream_mission_templates WHERE session_id=?",id);db.update("DELETE FROM livestream_lots WHERE session_id=?",id);db.update("DELETE FROM livestream_sessions WHERE id=?",id);
  for(long auction:auctions)db.update("DELETE FROM auctions WHERE id=?",auction);
  for(long p:productIds)db.update("DELETE FROM products WHERE id=?",p);
  var viewers=new ArrayList<>(List.of(first,second));viewers.addAll(extraUsers);
  for(long u:viewers){db.update("DELETE FROM coin_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id=?)",u);db.update("DELETE FROM wallets WHERE user_id=?",u);}
  viewers.add(host);for(long u:viewers)db.update("DELETE FROM users WHERE id=?",u);
 }
 @SuppressWarnings("unchecked") Map<String,Object> personal(RealtimePrincipal actor){return (Map<String,Object>)queries.snapshot(id,actor).get("mission");}
 long count(String table){return db.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE session_id=?",Long.class,id);}
 void stage(int index) {
  // Mission unit scenarios stage a lot directly; final-round scenarios below use production commands.
  db.update("UPDATE livestream_sessions SET status='LIVE',current_lot_index=? WHERE id=?",index,id);
  db.update("UPDATE livestream_lots SET phase='OPEN' WHERE id=?",lotIds.get(index));
  db.update("UPDATE auctions SET status='RUNNING',start_time=?,end_time=NULL WHERE id=?",java.sql.Timestamp.from(clock.instant()),auctions.get(index));
  service.heartbeat(id,publisher);
 }
 void pay(int index,RealtimePrincipal actor) {
  stage(index);service.bid(id,lotIds.get(index),actor,new LiveInput.Bid(UUID.randomUUID(),"100"));
  now+=5000;service.heartbeat(id,publisher);service.tick(id,false);
 }
 @Test void assignsPrivatelyAndKeepsMissionAfterRejoinAndServiceRecreation() throws Exception {
  var c=connection(a);service.join(id,c);var original=personal(a);
  assertThat(original).containsEntry("status","ASSIGNED").containsEntry("progress",0).containsEntry("ticket",false);
  presence.leave(c);service.join(id,connection(a));var expected=new LinkedHashMap<>(original);expected.put("version",queries.session(id,false).get("version"));assertThat(personal(a)).isEqualTo(expected);
  var reader=new LiveMissionService(db,clock);
  assertThat(reader.personal(id,a,queries.session(id,false))).containsEntry("title",original.get("title"));
  assertThat(personal(b)).containsEntry("status","WAITING").doesNotContainKeys("title","groupA","groupB");
  assertThat(queries.snapshot(id,admin).get("mission")).isNull();
  assertThat(queries.session(id,false)).doesNotContainKeys("mission","ticketCount");
  assertThat(queries.session(id,true,true)).containsEntry("ticketCount",0L);
  assertThat(count("livestream_user_missions")).isEqualTo(1);
 }
 @Test void oneOverlappingProductCountsOnceAndPaidPairIssuesOnlyOneTicket() throws Exception {
  service.join(id,connection(a));pay(2,a);
  assertThat(personal(a)).containsEntry("progress",1).containsEntry("ticket",false);
  stage(0);service.bid(id,lotIds.get(0),a,new LiveInput.Bid(UUID.randomUUID(),"100"));
  assertThat(personal(a)).containsEntry("progress",1).containsEntry("ticket",false);
  now+=5000;service.heartbeat(id,publisher);service.tick(id,false);service.tick(id,false);
  assertThat(personal(a)).containsEntry("progress",2).containsEntry("ticket",true);
  assertThat(count("livestream_tickets")).isEqualTo(1);
  assertThat(queries.session(id,true,true)).containsEntry("ticketCount",1L);
  assertThat(db.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,first)).isEqualTo(800);
  assertThat(queries.session(id,false)).containsEntry("finalState","LOCKED");
 }
 @Test void anotherBuyersPurchaseAndUnrelatedRegularProductDoNotAdvanceOwnMission() throws Exception {
  service.join(id,connection(a));service.join(id,connection(b));
  pay(3,a);assertThat(personal(a)).containsEntry("progress",0);
  pay(0,b);assertThat(personal(a)).containsEntry("progress",0);assertThat(personal(b)).containsEntry("progress",1);
  pay(1,a);assertThat(personal(a)).containsEntry("progress",1).containsEntry("ticket",false);
  assertThat(count("livestream_tickets")).isZero();
 }
 @Test void rollsBackPaymentAndTicketTogetherThenRetriesSuccessfully() throws Exception {
  service.join(id,connection(a));pay(0,a);stage(1);service.bid(id,lotIds.get(1),a,new LiveInput.Bid(UUID.randomUUID(),"100"));now+=5000;service.heartbeat(id,publisher);
  LiveMissionService target=org.springframework.test.util.AopTestUtils.getUltimateTargetObject(missions);
  doAnswer(inv->{inv.callRealMethod();throw new IllegalStateException("Fail after ticket write");}).when(target).afterPaid(id,first);
  assertThatThrownBy(()->service.tick(id,false)).isInstanceOf(IllegalStateException.class);
  assertThat(count("livestream_tickets")).isZero();assertThat(personal(a)).containsEntry("progress",1);
  assertThat(db.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auctions.get(1))).isEqualTo("RUNNING");
  assertThat(db.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Long.class,auctions.get(1))).isZero();
  doCallRealMethod().when(target).afterPaid(id,first);service.tick(id,false);
  assertThat(personal(a)).containsEntry("ticket",true);
 }
 @Test void lateViewerGetsNoImpossibleMissionAndRetriesDoNotReroll() throws Exception {
  service.join(id,connection(a));pay(0,a);pay(2,a);
  long assigned=db.queryForObject("SELECT template_id FROM livestream_user_missions WHERE session_id=? AND user_id=?",Long.class,id,first);
  service.join(id,connection(b));assertThat(personal(b)).containsEntry("status","UNAVAILABLE");
  service.join(id,connection(b));assertThat(personal(b)).containsEntry("status","UNAVAILABLE");
  service.join(id,connection(a));assertThat(personal(a)).containsEntry("status","ASSIGNED").containsEntry("ticket",true);
  assertThat(db.queryForObject("SELECT template_id FROM livestream_user_missions WHERE session_id=? AND user_id=?",Long.class,id,first)).isEqualTo(assigned);
  assertThat(count("livestream_user_missions")).isEqualTo(1);
 }
 @Test void lateViewerSelectsOnlyRemainingFeasibleTemplate() throws Exception {
  service.join(id,connection(a));pay(0,a);pay(2,a);
  db.update("INSERT INTO livestream_mission_templates(session_id,position,title) VALUES(?,1,'Remaining pair')",id);
  long template=db.queryForObject("SELECT id FROM livestream_mission_templates WHERE session_id=? AND position=1",Long.class,id);
  db.update("INSERT INTO livestream_mission_choices(template_id,group_key,lot_id) VALUES(?,'A',?),(?,'B',?)",template,lotIds.get(1),template,lotIds.get(3));
  service.join(id,connection(b));assertThat(personal(b)).containsEntry("title","Remaining pair");
 }
 @Test void overdueSaleIsSettledBeforeAssigningLateViewer() throws Exception {
  service.join(id,connection(a));pay(0,a);stage(2);service.bid(id,lotIds.get(2),a,new LiveInput.Bid(UUID.randomUUID(),"100"));now+=5000;service.heartbeat(id,publisher);
  service.join(id,connection(b));assertThat(personal(b)).containsEntry("status","UNAVAILABLE");
  assertThat(db.queryForObject("SELECT phase FROM livestream_lots WHERE id=?",String.class,lotIds.get(2))).isEqualTo("SOLD");
 }
 @Test void concurrentJoinsAndSettlementDoNotDuplicateMissionOrTicket() throws Exception {
  var c1=connection(a);var c2=connection(a);
  CompletableFuture.allOf(CompletableFuture.runAsync(()->service.join(id,c1)),CompletableFuture.runAsync(()->service.join(id,c2))).get(10,TimeUnit.SECONDS);
  assertThat(count("livestream_user_missions")).isEqualTo(1);
  pay(0,a);stage(1);service.bid(id,lotIds.get(1),a,new LiveInput.Bid(UUID.randomUUID(),"100"));now+=5000;service.heartbeat(id,publisher);
  CompletableFuture.allOf(CompletableFuture.runAsync(()->service.tick(id,false)),CompletableFuture.runAsync(()->service.tick(id,false))).get(10,TimeUnit.SECONDS);
  assertThat(count("livestream_tickets")).isEqualTo(1);
 }
 @Test void doesNotAssignWhenPausedEndedOrRevealed() throws Exception {
  db.update("UPDATE livestream_sessions SET status='PAUSED',pause_until=? WHERE id=?",java.sql.Timestamp.from(clock.instant().plusSeconds(60)),id);
  service.join(id,connection(a));assertThat(personal(a)).containsEntry("status","WAITING");
  db.update("UPDATE livestream_sessions SET status='SCHEDULED',final_state='REVEALED' WHERE id=?",id);
  service.join(id,connection(a));assertThat(personal(a)).containsEntry("status","CLOSED");
  db.update("UPDATE livestream_sessions SET status='ENDED',final_state='LOCKED' WHERE id=?",id);
  service.join(id,connection(a));assertThat(personal(a)).containsEntry("status","CLOSED");assertThat(count("livestream_user_missions")).isZero();
 }

 void command(String name,long lotId) { service.command(id,admin,name,new LiveInput.Command(UUID.randomUUID(),lotId)); }
 void startGame() throws Exception {service.join(id,connection(a));service.join(id,connection(b));command("start",lotIds.getFirst());}
 void buyInGame(int index,RealtimePrincipal actor,String amount) {
  long lot=lotIds.get(index);
  if(index!=0)command("select",lot);
  command("open",lot);service.bid(id,lot,actor,new LiveInput.Bid(UUID.randomUUID(),amount));now+=5000;service.heartbeat(id,publisher);service.tick(id,false);
 }
 void revealWithOneTicket(String regularAmount) throws Exception {
  startGame();buyInGame(0,a,regularAmount);buyInGame(1,a,regularAmount);buyInGame(2,b,"100");buyInGame(3,b,"100");
  assertThat(queries.session(id,false)).containsEntry("finalState","REVEALED");
  assertThat(personal(a)).containsEntry("ticket",true);assertThat(personal(b)).containsEntry("ticket",false);
 }
 @SuppressWarnings("unchecked") Map<String,Object> publicSecret() {
  return ((List<Map<String,Object>>)queries.session(id,true).get("lots")).getLast();
 }
 @Test void fullGameRevealsOnlyAfterAllRegularPaymentsThenRestrictsFinalBidToTicketOwner() throws Exception {
  startGame();
  var json=new com.fasterxml.jackson.databind.ObjectMapper();
  for(var payload:List.of(queries.list(),queries.state(b),queries.snapshot(id,b)))
   assertThat(json.writeValueAsString(payload)).doesNotContain(prefix+"4");
  assertThat(publicSecret()).containsEntry("hidden",true).doesNotContainKeys("productId","auctionId","startingPrice","currentPrice");
  assertThatThrownBy(()->command("select",lotIds.get(4))).isInstanceOf(LiveException.class);
  assertThatThrownBy(()->command("reopen",lotIds.get(4))).isInstanceOf(LiveException.class);
  buyInGame(0,a,"100");buyInGame(1,a,"100");assertThat(personal(a)).containsEntry("ticket",true);
  assertThat(queries.session(id,false)).containsEntry("finalState","LOCKED");
  buyInGame(2,b,"100");buyInGame(3,b,"100");
  assertThat(queries.session(id,false)).containsEntry("finalState","REVEALED");
  assertThat(publicSecret()).containsEntry("productId",Long.toString(productIds.get(4))).containsEntry("startingPrice","100").doesNotContainKey("hidden");
  long revision=Long.parseLong((String)queries.session(id,false).get("version"));service.tick(id,false);service.tick(id,false);
  assertThat(queries.session(id,false)).containsEntry("version",Long.toString(revision));
  command("next",lotIds.get(3));
  assertThat(publicSecret()).containsEntry("status","PRESENTING");
  assertThatThrownBy(()->service.bid(id,lotIds.get(4),a,new LiveInput.Bid(UUID.randomUUID(),"100"))).isInstanceOf(LiveException.class);
  command("open",lotIds.get(4));
  assertThatThrownBy(()->service.bid(id,lotIds.get(4),b,new LiveInput.Bid(UUID.randomUUID(),"100"))).isInstanceOf(LiveException.class).hasMessageContaining("vé");
  assertThat(db.queryForObject("SELECT COUNT(*) FROM bids WHERE auction_id=?",Long.class,auctions.get(4))).isZero();
  service.chat(id,b,new LiveInput.Chat(UUID.randomUUID(),"Good luck"));
  var request=new LiveInput.Bid(UUID.randomUUID(),"100");service.bid(id,lotIds.get(4),a,request);service.bid(id,lotIds.get(4),a,request);
  now+=5000;service.heartbeat(id,publisher);service.tick(id,false);
  assertThat(queries.session(id,false)).containsEntry("finalState","SOLD");assertThat(publicSecret()).containsEntry("status","SOLD");
  assertThat(db.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,first)).isEqualTo(700);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Long.class,auctions.get(4))).isEqualTo(2);
  command("end",lotIds.get(4));assertThat(queries.session(id,false)).containsEntry("status","ENDED");
 }
 @Test void multipleTicketOwnersUseExistingCoinHoldsAndHigherBidRulesInFinal() throws Exception {
  long template=db.queryForObject("SELECT id FROM livestream_mission_templates WHERE session_id=?",Long.class,id);
  db.update("INSERT INTO livestream_mission_choices(template_id,group_key,lot_id) VALUES(?,'B',?)",template,lotIds.get(3));
  startGame();buyInGame(0,a,"100");buyInGame(1,a,"100");buyInGame(2,b,"100");buyInGame(3,b,"100");
  assertThat(count("livestream_tickets")).isEqualTo(2);command("select",lotIds.get(4));command("open",lotIds.get(4));
  service.bid(id,lotIds.get(4),a,new LiveInput.Bid(UUID.randomUUID(),"100"));
  assertThatThrownBy(()->service.bid(id,lotIds.get(4),b,new LiveInput.Bid(UUID.randomUUID(),"100"))).isInstanceOf(LiveException.class);
  service.bid(id,lotIds.get(4),b,new LiveInput.Bid(UUID.randomUUID(),"101"));
  assertThat(db.queryForObject("SELECT locked_balance FROM wallets WHERE user_id=?",Long.class,first)).isZero();
  now+=5000;service.heartbeat(id,publisher);service.tick(id,false);
  assertThat(publicSecret()).containsEntry("leaderId",Long.toString(second)).containsEntry("currentPrice","101");
  assertThat(queries.session(id,false)).containsEntry("finalState","SOLD");
 }
 @Test void ticketDoesNotBypassInsufficientCoinAndSingleEligibleViewerCanSkip() throws Exception {
  revealWithOneTicket("500");command("select",lotIds.get(4));command("open",lotIds.get(4));
  assertThatThrownBy(()->service.bid(id,lotIds.get(4),a,new LiveInput.Bid(UUID.randomUUID(),"100"))).isInstanceOf(RuntimeException.class);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM bids WHERE auction_id=?",Long.class,auctions.get(4))).isZero();
  command("end",lotIds.get(4));
  assertThat(queries.session(id,false)).containsEntry("finalState","REVEALED").containsEntry("status","ENDED");
  assertThat(publicSecret()).containsEntry("status","UNSOLD").containsKey("productId");
 }
 @Test void singleEligibleViewerCanDeclineWithoutAnAutomaticPurchase() throws Exception {
  revealWithOneTicket("100");command("select",lotIds.get(4));command("end",lotIds.get(4));
  assertThat(queries.session(id,false)).containsEntry("finalState","REVEALED").containsEntry("status","ENDED");
  assertThat(publicSecret()).containsEntry("status","UNSOLD").containsKey("productId");
  assertThat(db.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,first)).isEqualTo(800);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM bids WHERE auction_id=?",Long.class,auctions.get(4))).isZero();
 }
 @Test void restartBeforeRevealThenTimeoutKeepsSecretHiddenAndPaidOrdersIntact() throws Exception {
  startGame();buyInGame(0,a,"100");buyInGame(1,a,"100");service.tick(id,true);
  now+=300001;service.tick(id,false);
  assertThat(queries.session(id,false)).containsEntry("status","ENDED").containsEntry("finalState","SKIPPED");
  assertThat(publicSecret()).containsEntry("hidden",true);assertThat(queries.purchases(a)).hasSize(2);
 }
 @Test void allRegularSoldWithoutTicketsNeverRevealsSecret() throws Exception {
  var third=user("c","USER");var c=new RealtimePrincipal(third,prefix+"c",RealtimePrincipal.Role.USER);
  service.join(id,connection(c));startGame();buyInGame(0,a,"100");buyInGame(1,b,"100");buyInGame(2,c,"100");buyInGame(3,a,"100");
  assertThat(count("livestream_tickets")).isZero();assertThat(queries.session(id,false)).containsEntry("finalState","LOCKED");
  assertThatThrownBy(()->command("next",lotIds.get(3))).isInstanceOf(LiveException.class);
  assertThatThrownBy(()->command("select",lotIds.get(4))).isInstanceOf(LiveException.class);
  command("end",lotIds.get(3));assertThat(queries.session(id,false)).containsEntry("finalState","SKIPPED");
  assertThat(publicSecret()).containsEntry("hidden",true).doesNotContainKeys("productId","startingPrice","auctionId");
 }
 @Test void unsoldRegularAndEarlyEndKeepPurchasesButDoNotOpenSecret() throws Exception {
  startGame();buyInGame(0,a,"100");buyInGame(1,a,"100");
  command("select",lotIds.get(2));command("open",lotIds.get(2));command("next",lotIds.get(2)); // skip a no-bid regular lot
  assertThat(queries.session(id,false)).containsEntry("finalState","LOCKED");
  command("end",lotIds.get(3));
  assertThat(queries.session(id,false)).containsEntry("finalState","SKIPPED");assertThat(publicSecret()).containsEntry("hidden",true);
  assertThat(queries.purchases(a)).hasSize(2);
  assertThat(db.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,first)).isEqualTo(800);
 }
 @Test void finalPauseResumeAndRestartKeepRevealedProductAndFreezeBidDeadline() throws Exception {
  revealWithOneTicket("100");command("select",lotIds.get(4));command("open",lotIds.get(4));service.bid(id,lotIds.get(4),a,new LiveInput.Bid(UUID.randomUUID(),"100"));
  now+=1000;service.tick(id,true);assertThat(queries.session(id,false)).containsEntry("status","PAUSED").containsEntry("remainingMs",4000L).containsEntry("finalState","OPEN");
  assertThatThrownBy(()->service.bid(id,lotIds.get(4),a,new LiveInput.Bid(UUID.randomUUID(),"101"))).isInstanceOf(LiveException.class);
  now+=10000;service.join(id,publisher);service.ready(id,publisher,true);command("resume",lotIds.get(4));
  now+=4000;service.heartbeat(id,publisher);service.tick(id,false);assertThat(queries.session(id,false)).containsEntry("finalState","SOLD");
 }
 @Test void disconnectTimeoutRefundsFinalHoldAndKeepsAlreadyRevealedIdentity() throws Exception {
  revealWithOneTicket("100");command("select",lotIds.get(4));command("open",lotIds.get(4));service.bid(id,lotIds.get(4),a,new LiveInput.Bid(UUID.randomUUID(),"100"));
  service.disconnected(id,publisher.socket.getId());now+=300001;service.tick(id,false);
  assertThat(queries.session(id,false)).containsEntry("status","ENDED").containsEntry("finalState","REVEALED");
  assertThat(publicSecret()).containsKey("productId");
  assertThat(db.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,first)).isEqualTo(800);
  assertThat(db.queryForObject("SELECT locked_balance FROM wallets WHERE user_id=?",Long.class,first)).isZero();
 }
 @Test void rollbackLastRegularPaymentDoesNotRevealUntilRetryCommits() throws Exception {
  startGame();buyInGame(0,a,"100");buyInGame(1,a,"100");buyInGame(2,b,"100");command("select",lotIds.get(3));command("open",lotIds.get(3));
  service.bid(id,lotIds.get(3),b,new LiveInput.Bid(UUID.randomUUID(),"100"));now+=5000;service.heartbeat(id,publisher);
  LiveMissionService target=org.springframework.test.util.AopTestUtils.getUltimateTargetObject(missions);
  doAnswer(inv->{inv.callRealMethod();throw new IllegalStateException("Fail last payment");}).when(target).afterPaid(id,second);
  assertThatThrownBy(()->service.tick(id,false)).isInstanceOf(IllegalStateException.class);
  assertThat(queries.session(id,false)).containsEntry("finalState","LOCKED");assertThat(publicSecret()).containsEntry("hidden",true);
  doCallRealMethod().when(target).afterPaid(id,second);service.tick(id,false);
  assertThat(queries.session(id,false)).containsEntry("finalState","REVEALED");
 }
}
