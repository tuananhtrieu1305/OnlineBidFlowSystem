package com.group6.auction.wallet.service;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;

/**
 * Internal auction API. Caller owns the bid/result transaction.
 * This facade acquires the auction lock first, then ALL affected wallets in ID order.
 */
@Service @Profile("!probe")
@Transactional(propagation=Propagation.MANDATORY)
public class WalletTransferService {
 private final WalletLedger ledger;
 private final JdbcTemplate jdbc;
 public WalletTransferService(WalletLedger ledger,JdbcTemplate jdbc){this.ledger=ledger;this.jdbc=jdbc;}
 private record Auction(String status,Long winner,Long price) {}
 private Auction auction(long id) {
  // The caller may already have read bids. Reject a stale REPEATABLE_READ snapshot
  // before discovering participant wallets, otherwise settlement could miss a hold.
  if (!Objects.equals(org.springframework.transaction.support.TransactionSynchronizationManager.getCurrentTransactionIsolationLevel(),
      org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED))
   throw new org.springframework.transaction.IllegalTransactionStateException("Auction wallet operations require explicit READ_COMMITTED isolation");
  var rows=jdbc.query("SELECT status,winner_user_id,winning_price FROM auctions WHERE id=? FOR UPDATE",
   (rs,n)->new Auction(rs.getString(1),rs.getObject(2,Long.class),rs.getObject(3,Long.class)),id);
  if(rows.size()!=1)throw new WalletException(404,"AUCTION_NOT_FOUND");return rows.getFirst();
 }
 private Map<Long,WalletLedger.Balance> lockWallets(Collection<Long> ids){
  Map<Long,WalletLedger.Balance> result=new LinkedHashMap<>();
  new TreeSet<>(ids).forEach(id->result.put(id,ledger.lock(id)));return result;
 }
 private void running(Auction auction){if(!"RUNNING".equals(auction.status()))throw WalletException.conflict("AUCTION_NOT_RUNNING");}
 public void lockToAmount(long auctionId,long userId,long target){
  running(auction(auctionId));
  if(target<=0)throw new WalletException(400,"INVALID_AMOUNT");
  var wallet=ledger.lock(ledger.byUser(userId).id());
  long held=ledger.held(wallet,auctionId);
  if(target<held)throw WalletException.conflict("LOCK_TARGET_BELOW_CURRENT");
  long delta=target-held;
  if(delta>0)ledger.change(wallet,auctionId,"LOCK",-delta,delta);
 }
 /** NORMAL leader replacement; never call separate lock/release methods in arbitrary wallet order. */
 public void replaceLeader(long auctionId,Long previousUserId,long nextUserId,long target){
  running(auction(auctionId));
  if(target<=0)throw new WalletException(400,"INVALID_AMOUNT");
  long nextId=ledger.byUser(nextUserId).id();
  Long previousId=previousUserId==null?null:ledger.byUser(previousUserId).id();
  var ids=new HashSet<Long>();ids.add(nextId);if(previousId!=null)ids.add(previousId);
  var locked=lockWallets(ids);var next=locked.get(nextId);
  long held=ledger.held(next,auctionId);
  if(target<held)throw WalletException.conflict("LOCK_TARGET_BELOW_CURRENT");
  if(previousId!=null&&!previousId.equals(nextId)){
   var previous=locked.get(previousId);long amount=ledger.held(previous,auctionId);
   if(amount>0)ledger.change(previous,auctionId,"UNLOCK",amount,-amount);
  }
  if(target>held)ledger.change(next,auctionId,"LOCK",-(target-held),target-held);
 }
 public void releaseAll(long auctionId,long userId){
  running(auction(auctionId));
  var wallet=ledger.lock(ledger.byUser(userId).id());long held=ledger.held(wallet,auctionId);
  if(held>0)ledger.change(wallet,auctionId,"UNLOCK",held,-held);
 }
 public void releaseAuction(long auctionId){
  var auction=auction(auctionId);
  if(!Set.of("RUNNING","UNSOLD").contains(auction.status()))throw WalletException.conflict("INVALID_SETTLEMENT");
  var locked=lockWallets(ledger.auctionWalletIds(auctionId));
  if(paymentRows(auctionId).size()>0)throw WalletException.conflict("SETTLEMENT_CONFLICT");
  for(var wallet:locked.values()){
   long amount=ledger.held(wallet,auctionId);
   if(amount>0)ledger.change(wallet,auctionId,"UNLOCK",amount,-amount);
  }
 }
 public void settleAuction(long auctionId,long winnerUserId,long winningAmount){
  var auction=auction(auctionId);
  if(winningAmount<=0)throw new WalletException(400,"INVALID_AMOUNT");
  if(!Set.of("RUNNING","SOLD").contains(auction.status()))throw WalletException.conflict("INVALID_SETTLEMENT");
  if("SOLD".equals(auction.status())&&(!Objects.equals(auction.winner(),winnerUserId)||!Objects.equals(auction.price(),winningAmount)))
   throw WalletException.conflict("SETTLEMENT_CONFLICT");
  long winnerId=ledger.byUser(winnerUserId).id(),systemId=ledger.systemId();
  var ids=new HashSet<>(ledger.auctionWalletIds(auctionId));ids.add(winnerId);ids.add(systemId);
  var wallets=lockWallets(ids);
  var paid=paymentRows(auctionId);
  if(!paid.isEmpty()){
   boolean exact=paid.size()==2
    && paid.stream().anyMatch(r->r[0]==winnerId&&r[1]==0&&r[2]==-winningAmount)
    && paid.stream().anyMatch(r->r[0]==systemId&&r[1]==winningAmount&&r[2]==0);
   if(!exact)throw WalletException.conflict("SETTLEMENT_CONFLICT");
   for(var wallet:wallets.values())if(ledger.held(wallet,auctionId)!=0)throw WalletException.conflict("SETTLEMENT_CONFLICT");
   return;
  }
  var winner=wallets.get(winnerId);long held=ledger.held(winner,auctionId);
  if(held<winningAmount)throw WalletException.conflict("INSUFFICIENT_LOCKED_COIN");
  // Validate every involved wallet before moving any Coin.
  for(var wallet:wallets.values())ledger.held(wallet,auctionId);
  winner=ledger.change(winner,auctionId,"PAYMENT",0,-winningAmount);
  if(held>winningAmount)ledger.change(winner,auctionId,"UNLOCK",held-winningAmount,-(held-winningAmount));
  ledger.change(wallets.get(systemId),auctionId,"PAYMENT",winningAmount,0);
  for(var wallet:wallets.values()){
   if(wallet.id()==winnerId||wallet.id()==systemId)continue;
   long amount=ledger.held(wallet,auctionId);
   if(amount>0)ledger.change(wallet,auctionId,"UNLOCK",amount,-amount);
  }
 }
 private List<long[]> paymentRows(long auctionId){
  return jdbc.query("SELECT wallet_id,available_delta,locked_delta FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT' ORDER BY id FOR UPDATE",
   (rs,n)->new long[]{rs.getLong(1),rs.getLong(2),rs.getLong(3)},auctionId);
 }
}
