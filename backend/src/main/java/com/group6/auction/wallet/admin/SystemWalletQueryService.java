package com.group6.auction.wallet.admin;
import com.group6.auction.wallet.dto.TransactionResponse;
import com.group6.auction.wallet.service.WalletException;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.*;

@Service @Profile("!probe")
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class SystemWalletQueryService {
 private final JdbcTemplate jdbc;private final Clock clock;
 public SystemWalletQueryService(JdbcTemplate jdbc,Clock clock){this.jdbc=jdbc;this.clock=clock;}
 private record Balance(long id,String available,String locked,String updated){}
 public record Summary(String walletId,String availableBalance,String lockedBalance,String totalReceivedCoin,String updatedAt,String readAt){}
 public record History(List<TransactionResponse> items,String nextCursor){}
 private Balance balance(){
  var rows=jdbc.query("SELECT id,available_balance,locked_balance,updated_at FROM wallets WHERE wallet_type='SYSTEM' LIMIT 2",(r,n)->new Balance(r.getLong(1),r.getString(2),r.getString(3),r.getObject(4,LocalDateTime.class).toInstant(ZoneOffset.UTC).toString()));
  if(rows.size()!=1)throw WalletException.conflict("SYSTEM_WALLET_INVALID");return rows.getFirst();
 }
 public Summary summary(){
  var w=balance();var total=jdbc.queryForObject("SELECT COALESCE(SUM(available_delta),0) FROM coin_transactions WHERE wallet_id=? AND transaction_type='PAYMENT' AND available_delta>0",java.math.BigDecimal.class,w.id());
  return new Summary(""+w.id(),w.available(),w.locked(),total.toPlainString(),w.updated(),clock.instant().toString());
 }
 public History history(SystemWalletFilters f,String rawCursor){
  var w=balance();var cursor=SystemWalletCursor.decode(rawCursor,w.id(),f);
  var sql=new StringBuilder("SELECT id,auction_id,transaction_type,available_delta,locked_delta,created_at FROM coin_transactions WHERE wallet_id=?");List<Object> args=new ArrayList<>();args.add(w.id());
  if(f.auctionId()!=null){sql.append(" AND auction_id=?");args.add(f.auctionId());}
  if(!f.type().isEmpty()){sql.append(" AND transaction_type=?");args.add(f.type());}
  if(f.from()!=null){sql.append(" AND created_at>=?");args.add(f.from());}
  if(f.to()!=null){sql.append(" AND created_at<?");args.add(f.to());}
  if(cursor!=null){sql.append(" AND (created_at<? OR (created_at=? AND id<?))");args.add(cursor.time());args.add(cursor.time());args.add(cursor.id());}
  sql.append(" ORDER BY created_at DESC,id DESC LIMIT ?");args.add(f.limit()+1);
  var items=jdbc.query(sql.toString(),(r,n)->new TransactionResponse(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getObject(6,LocalDateTime.class).toInstant(ZoneOffset.UTC).toString()),args.toArray());
  String next=null;if(items.size()>f.limit()){items=new ArrayList<>(items.subList(0,f.limit()));var last=items.getLast();next=new SystemWalletCursor(LocalDateTime.ofInstant(Instant.parse(last.createdAt()),ZoneOffset.UTC),Long.parseLong(last.id())).encode(w.id(),f);}
  return new History(items,next);
 }
}
