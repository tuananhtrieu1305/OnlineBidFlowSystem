package com.group6.auction;

import com.group6.auction.auction.integration.AuctionWalletIntegration;
import com.group6.auction.realtime.connection.*;
import com.group6.auction.realtime.room.*;
import com.group6.auction.realtime.replay.*;
import com.group6.auction.wallet.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class AuctionWalletIntegrationIT {
 @Autowired JdbcTemplate jdbc;
 @Autowired AuctionWalletIntegration integration;
 @Autowired WalletQueryService wallets;
 @Autowired PlatformTransactionManager manager;
 @Autowired RealtimeSessionRegistry registry;
 @Autowired RoomMembershipService rooms;
 @Autowired AuctionSnapshotService snapshots;
 @Autowired ReplayService replay;
 @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
 TransactionTemplate tx;
 long alice,bob,product,auction;
 String prefix;
 final List<WebSocketSession> sockets=new ArrayList<>();
 final List<String> aliceEvents=new CopyOnWriteArrayList<>(),bobEvents=new CopyOnWriteArrayList<>();
 @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");}
 @BeforeEach void setup() throws Exception {
  prefix="p3_"+UUID.randomUUID().toString().substring(0,8);
  tx=new TransactionTemplate(manager);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
  alice=user("a");bob=user("b");
  jdbc.update("INSERT INTO products(name,quantity) VALUES (?,1)",prefix);
  product=jdbc.queryForObject("SELECT id FROM products WHERE name=?",Long.class,prefix);
  jdbc.update("INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,min_bid_increment,start_time,end_time,status) VALUES (?,?,'NORMAL','PUBLIC',100,10,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),'RUNNING')",product,alice);
  auction=jdbc.queryForObject("SELECT id FROM auctions WHERE product_id=?",Long.class,product);
  socket(alice,aliceEvents);socket(bob,bobEvents);
 }
 long user(String suffix){
  String name=prefix+suffix;
  jdbc.update("INSERT INTO users(username,password_hash,role) VALUES (?,'unused-test-hash','USER')",name);
  long id=jdbc.queryForObject("SELECT id FROM users WHERE username=?",Long.class,name);
  jdbc.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES (?,'USER',0,0,UTC_TIMESTAMP(6))",id);
  wallets.deposit(name,1000);return id;
 }
 void socket(long user,List<String> events) throws Exception {
  var socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn(prefix+user);when(socket.isOpen()).thenReturn(true);
  doAnswer(call->{events.add(((TextMessage)call.getArgument(0)).getPayload());return null;}).when(socket).sendMessage(any());
  var principal=new RealtimePrincipal(user,prefix+user,RealtimePrincipal.Role.USER);
  registry.register(socket,principal);sockets.add(socket);assertThat(rooms.join(socket.getId(),principal,auction,null).allowed()).isTrue();
 }
 long bid(long user,long amount){
  // Fixture stands in for the owner module: lock first, then persist its validated decision.
  jdbc.queryForObject("SELECT id FROM auctions WHERE id=? FOR UPDATE",Long.class,auction);
  jdbc.update("INSERT INTO bids(auction_id,user_id,amount,created_at) VALUES (?,?,?,UTC_TIMESTAMP(6))",auction,user,amount);
  return jdbc.queryForObject("SELECT MAX(id) FROM bids WHERE auction_id=?",Long.class,auction);
 }
 void blind(){jdbc.update("UPDATE auctions SET auction_type='BLIND',min_bid_increment=NULL WHERE id=?",auction);}
 long held(long user){return jdbc.queryForObject("SELECT locked_balance FROM wallets WHERE user_id=?",Long.class,user);}
 long available(long user){return jdbc.queryForObject("SELECT available_balance FROM wallets WHERE user_id=?",Long.class,user);}
 String status(){return jdbc.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction);}
 int payments(){return jdbc.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Integer.class,auction);}
 @AfterEach void clean(){
  for(var socket:sockets){rooms.disconnect(socket.getId());registry.unregister(socket);}sockets.clear();
  long credit=jdbc.queryForObject("SELECT COALESCE(SUM(t.available_delta),0) FROM coin_transactions t JOIN wallets w ON w.id=t.wallet_id WHERE t.auction_id=? AND w.wallet_type='SYSTEM'",Long.class,auction);
  jdbc.update("UPDATE wallets SET available_balance=available_balance-? WHERE wallet_type='SYSTEM'",credit);
  jdbc.update("DELETE FROM coin_transactions WHERE auction_id=? OR wallet_id IN (SELECT id FROM wallets WHERE user_id IN (?,?))",auction,alice,bob);
  jdbc.update("DELETE FROM bids WHERE auction_id=?",auction);jdbc.update("DELETE FROM auction_participants WHERE auction_id=?",auction);
  jdbc.update("DELETE FROM auctions WHERE id=?",auction);jdbc.update("DELETE FROM products WHERE id=?",product);
  jdbc.update("DELETE FROM wallets WHERE user_id IN (?,?)",alice,bob);jdbc.update("DELETE FROM users WHERE id IN (?,?)",alice,bob);
 }
 @Test void normalLeaderCoinAndEventCommitTogether(){
  tx.executeWithoutResult(s->{integration.normalBidAccepted(auction,bid(alice,200),null,210);assertThat(aliceEvents).isEmpty();});
  assertThat(held(alice)).isEqualTo(200);assertThat(aliceEvents).hasSize(1);assertThat(bobEvents).hasSize(1);
  tx.executeWithoutResult(s->integration.normalBidAccepted(auction,bid(bob,300),alice,310));
  assertThat(held(alice)).isZero();assertThat(available(alice)).isEqualTo(1000);assertThat(held(bob)).isEqualTo(300);
  assertThat(bobEvents.getLast()).contains("NORMAL_PRICE_UPDATED","\"currentPrice\":300");
 }
 @Test void rollbackAndInsufficientCoinLeaveNoBidHoldOrEvent(){
  tx.executeWithoutResult(s->{integration.normalBidAccepted(auction,bid(alice,200),null,210);s.setRollbackOnly();});
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.normalBidAccepted(auction,bid(alice,2000),null,2010))).isInstanceOf(WalletException.class);
  assertThat(held(alice)).isZero();assertThat(aliceEvents).isEmpty();
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM bids WHERE auction_id=?",Integer.class,auction)).isZero();
 }
 @Test void blindIsPrivateAndReconnectReplayReadCommittedResult() throws Exception {
  blind();tx.executeWithoutResult(s->integration.blindBidAccepted(auction,bid(alice,400)));
  assertThat(aliceEvents).hasSize(1);assertThat(aliceEvents.getFirst()).contains("BLIND_BID_ACCEPTED");assertThat(bobEvents).isEmpty();
  String bobSnapshot=json.writeValueAsString(snapshots.buildSnapshot(auction,bob).orElseThrow());
  assertThat(bobSnapshot).doesNotContain("startingPrice","\"amount\":400","leadingUser");
  assertThat(json.writeValueAsString(snapshots.buildSnapshot(auction,alice).orElseThrow())).contains("\"amount\":400");
  tx.executeWithoutResult(s->integration.finishSold(auction,alice,400));
  assertThat(status()).isEqualTo("SOLD");assertThat(held(alice)).isZero();assertThat(payments()).isEqualTo(2);
  assertThat(bobEvents).hasSize(1);assertThat(bobEvents.getFirst()).contains("AUCTION_FINISHED").doesNotContain("startingPrice");
  var result=replay.buildReplay(auction,new ReplayViewer(bob,RealtimePrincipal.Role.USER));
  assertThat(result.result().winningPrice()).isEqualTo(400);assertThat(result.status()).isEqualTo("SOLD");
 }
 @Test void finishRollbackRetryAndConflict(){
  tx.executeWithoutResult(s->integration.normalBidAccepted(auction,bid(alice,200),null,210));aliceEvents.clear();bobEvents.clear();
  tx.executeWithoutResult(s->{integration.finishSold(auction,alice,200);s.setRollbackOnly();});
  assertThat(status()).isEqualTo("RUNNING");assertThat(payments()).isZero();assertThat(held(alice)).isEqualTo(200);assertThat(aliceEvents).isEmpty();
  tx.executeWithoutResult(s->integration.finishSold(auction,alice,200));
  tx.executeWithoutResult(s->integration.finishSold(auction,alice,200));
  assertThat(payments()).isEqualTo(2);assertThat(aliceEvents).hasSize(1);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.finishSold(auction,bob,200))).isInstanceOf(WalletException.class);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.finishUnsold(auction))).isInstanceOf(WalletException.class);
 }
 @Test void unsoldReleasesEveryHoldOnce(){
  blind();tx.executeWithoutResult(s->{integration.blindBidAccepted(auction,bid(alice,50));integration.blindBidAccepted(auction,bid(bob,60));});
  aliceEvents.clear();bobEvents.clear();
  tx.executeWithoutResult(s->integration.finishUnsold(auction));tx.executeWithoutResult(s->integration.finishUnsold(auction));
  assertThat(status()).isEqualTo("UNSOLD");assertThat(held(alice)+held(bob)).isZero();assertThat(available(alice)+available(bob)).isEqualTo(2000);assertThat(payments()).isZero();assertThat(aliceEvents).hasSize(1);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.finishSold(auction,alice,50))).isInstanceOf(WalletException.class);
 }
 @Test void concurrentFinishCannotDoublePayOrPublish() throws Exception {
  tx.executeWithoutResult(s->integration.normalBidAccepted(auction,bid(alice,200),null,210));aliceEvents.clear();
  try(var pool=Executors.newFixedThreadPool(2)){
   var a=pool.submit(()->tx.executeWithoutResult(s->integration.finishSold(auction,alice,200)));
   var b=pool.submit(()->tx.executeWithoutResult(s->integration.finishSold(auction,alice,200)));
   a.get(10,TimeUnit.SECONDS);b.get(10,TimeUnit.SECONDS);
  }
  assertThat(payments()).isEqualTo(2);assertThat(aliceEvents).hasSize(1);
 }
 @Test void rejectsWrongTypeForeignBidUnbackedWinnerAndTransaction(){
  assertThatThrownBy(()->integration.finishUnsold(auction)).isInstanceOf(IllegalTransactionStateException.class);
  assertThatThrownBy(()->new TransactionTemplate(manager).executeWithoutResult(s->integration.finishUnsold(auction))).isInstanceOf(IllegalTransactionStateException.class);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.blindBidAccepted(auction,bid(alice,200)))).isInstanceOf(WalletException.class);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.normalBidAccepted(auction,Long.MAX_VALUE,null,210))).isInstanceOf(WalletException.class);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.normalBidAccepted(auction,bid(alice,200),null,200))).isInstanceOf(WalletException.class);
  assertThatThrownBy(()->tx.executeWithoutResult(s->integration.finishSold(auction,alice,200))).isInstanceOf(WalletException.class);
  assertThat(status()).isEqualTo("RUNNING");assertThat(aliceEvents).isEmpty();
 }
}
