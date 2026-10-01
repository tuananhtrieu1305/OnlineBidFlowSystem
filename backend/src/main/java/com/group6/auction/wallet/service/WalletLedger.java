package com.group6.auction.wallet.service;

import com.group6.auction.wallet.dto.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.time.*;
import java.util.*;

/** Parameterized SQL and current reads for balance operations, sharing the outer JPA transaction. */
@Repository @Profile("!probe")
public class WalletLedger {
 private final JdbcTemplate jdbc;
 public WalletLedger(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public record Balance(long id,Long userId,String type,long available,long locked,LocalDateTime updatedAt) {
  public WalletResponse response(){return new WalletResponse(""+id,""+available,""+locked,updatedAt.toInstant(ZoneOffset.UTC).toString());}
 }
 static final RowMapper<Balance> MAPPER=(rs,n)->new Balance(rs.getLong("id"),rs.getObject("user_id",Long.class),
  rs.getString("wallet_type"),rs.getLong("available_balance"),rs.getLong("locked_balance"),rs.getObject("updated_at",LocalDateTime.class));
 public Balance personal(String username,boolean lock){
  var list=jdbc.query("SELECT w.* FROM wallets w JOIN users u ON w.user_id=u.id WHERE u.username=? AND u.role='USER' AND w.wallet_type='USER'"+(lock?" FOR UPDATE":""),MAPPER,username);
  if(list.size()!=1) throw new WalletException(404,"WALLET_NOT_FOUND"); return list.getFirst();
 }
 public Balance byUser(long userId){
  var list=jdbc.query("SELECT * FROM wallets WHERE user_id=? AND wallet_type='USER'",MAPPER,userId);
  if(list.size()!=1)throw new WalletException(404,"WALLET_NOT_FOUND");return list.getFirst();
 }
 public Balance lock(long id){
  var list=jdbc.query("SELECT * FROM wallets WHERE id=? FOR UPDATE",MAPPER,id);
  if(list.size()!=1)throw new WalletException(404,"WALLET_NOT_FOUND");return list.getFirst();
 }
 public long systemId(){
  var ids=jdbc.queryForList("SELECT id FROM wallets WHERE wallet_type='SYSTEM'",Long.class);
  if(ids.size()!=1)throw WalletException.conflict("SYSTEM_WALLET_INVALID");return ids.getFirst();
 }
 public List<Long> auctionWalletIds(long auctionId){
  return jdbc.queryForList("SELECT DISTINCT wallet_id FROM coin_transactions WHERE auction_id=? ORDER BY wallet_id",Long.class,auctionId);
 }
 public long held(Balance wallet,long auctionId){
  // Current locking reads avoid using an old REPEATABLE_READ snapshot.
  var rows=jdbc.query("SELECT auction_id,locked_delta FROM coin_transactions WHERE wallet_id=? ORDER BY id FOR UPDATE",
   (rs,n)->new long[]{rs.getObject(1)==null?0:rs.getLong(1),rs.getLong(2)},wallet.id());
  long total=0,held=0;
  Map<Long,Long> byAuction=new HashMap<>();
  for(var row:rows){
   total=Math.addExact(total,row[1]);
   if(row[0]==0 && row[1]!=0)throw WalletException.conflict("WALLET_LEDGER_INCONSISTENT");
   byAuction.merge(row[0],row[1],Math::addExact);
   if(row[0]==auctionId)held=Math.addExact(held,row[1]);
  }
  if(total!=wallet.locked() || byAuction.values().stream().anyMatch(v->v<0))throw WalletException.conflict("WALLET_LEDGER_INCONSISTENT");
  return held;
 }
 public Balance change(Balance wallet,Long auctionId,String type,long availableDelta,long lockedDelta){
  long available,locked;
  try {available=Math.addExact(wallet.available(),availableDelta);locked=Math.addExact(wallet.locked(),lockedDelta);}
  catch(ArithmeticException ex){throw WalletException.conflict("BALANCE_OVERFLOW");}
  if(available<0||locked<0)throw WalletException.conflict("INSUFFICIENT_COIN");
  LocalDateTime now=LocalDateTime.now(ZoneOffset.UTC);
  jdbc.update("UPDATE wallets SET available_balance=?,locked_balance=?,updated_at=? WHERE id=?",available,locked,now,wallet.id());
  jdbc.update("INSERT INTO coin_transactions(wallet_id,auction_id,transaction_type,available_delta,locked_delta,created_at) VALUES (?,?,?,?,?,?)",
   wallet.id(),auctionId,type,availableDelta,lockedDelta,now);
  return new Balance(wallet.id(),wallet.userId(),wallet.type(),available,locked,now);
 }
}
