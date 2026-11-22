package com.group6.auction.wallet.service;

import com.group6.auction.wallet.dto.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;

@Service @Profile("!probe")
public class WalletQueryService {
 private final WalletLedger ledger;
 private final JdbcTemplate jdbc;
 public WalletQueryService(WalletLedger ledger,JdbcTemplate jdbc){this.ledger=ledger;this.jdbc=jdbc;}
 @Transactional(readOnly=true) public WalletResponse balance(String username){return ledger.personal(username,false).response();}
 @Transactional public WalletResponse deposit(String username,long amount){
  if(amount<=0)throw new WalletException(400,"INVALID_AMOUNT");
  return ledger.change(ledger.personal(username,true),null,"DEPOSIT",amount,0).response();
 }
 public record History(List<TransactionResponse> items,String nextCursor) {}
 public record AuctionBid(String id,String amount,String createdAt) {}
 public record AuctionBidHistory(String auctionId,String productName,List<AuctionBid> bids) {}
 @Transactional(readOnly=true) public History history(String username,String type,int limit,String cursor){
  if(limit<1||limit>100 || type!=null&&!Set.of("DEPOSIT","LOCK","UNLOCK","PAYMENT","CLUE_TRADE").contains(type))
   throw new WalletException(400,"INVALID_FILTER");
  var wallet=ledger.personal(username,false);
  String sql="SELECT * FROM coin_transactions WHERE wallet_id=?";
  List<Object> args=new ArrayList<>();args.add(wallet.id());
  if(type!=null){sql+=" AND transaction_type=?";args.add(type);}
  if(cursor!=null){
   try {
    if(cursor.length()>256)throw new IllegalArgumentException();
    String[] parts=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split("\\|");
    if(parts.length!=2)throw new IllegalArgumentException();
    LocalDateTime time=LocalDateTime.parse(parts[0]);long id=Long.parseLong(parts[1]);
    if(id<=0)throw new IllegalArgumentException();
    sql+=" AND (created_at<? OR (created_at=? AND id<?))";args.add(time);args.add(time);args.add(id);
   }catch(RuntimeException ex){throw new WalletException(400,"INVALID_CURSOR");}
  }
  sql+=" ORDER BY created_at DESC,id DESC LIMIT ?";args.add(limit+1);
  var items=jdbc.query(sql,(rs,n)->new TransactionResponse(rs.getString("id"),rs.getString("auction_id"),rs.getString("transaction_type"),
   rs.getString("available_delta"),rs.getString("locked_delta"),rs.getObject("created_at",LocalDateTime.class).toInstant(ZoneOffset.UTC).toString()),args.toArray());
  String next=null;
  if(items.size()>limit){
   items=new ArrayList<>(items.subList(0,limit));var last=items.getLast();
   next=Base64.getUrlEncoder().withoutPadding().encodeToString((LocalDateTime.ofInstant(Instant.parse(last.createdAt()),ZoneOffset.UTC)+"|"+last.id()).getBytes(StandardCharsets.UTF_8));
  }
  return new History(items,next);
 }
 @Transactional(readOnly=true) public AuctionBidHistory auctionBids(String username,long auctionId){
  var wallet=ledger.personal(username,false);
  var products=jdbc.query("SELECT p.name FROM auctions a JOIN products p ON p.id=a.product_id WHERE a.id=? AND EXISTS (SELECT 1 FROM coin_transactions t WHERE t.wallet_id=? AND t.auction_id=a.id)",
   (rs,n)->rs.getString(1),auctionId,wallet.id());
  if(products.isEmpty())throw new WalletException(404,"AUCTION_NOT_FOUND");
  var bids=jdbc.query("SELECT id,amount,created_at FROM bids WHERE auction_id=? AND user_id=? ORDER BY created_at,id",
   (rs,n)->new AuctionBid(rs.getString("id"),rs.getString("amount"),rs.getObject("created_at",LocalDateTime.class).toInstant(ZoneOffset.UTC).toString()),auctionId,wallet.userId());
  return new AuctionBidHistory(Long.toString(auctionId),products.getFirst(),bids);
 }
}
