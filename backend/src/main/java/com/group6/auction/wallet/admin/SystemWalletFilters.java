package com.group6.auction.wallet.admin;
import com.group6.auction.wallet.service.WalletException;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.Set;
public record SystemWalletFilters(Long auctionId,String type,LocalDateTime from,LocalDateTime to,int limit) {
 public static SystemWalletFilters parse(String id,String type,String from,String to,int limit){
  try{
   type=type==null?"":type;
   if(!Set.of("","DEPOSIT","LOCK","UNLOCK","PAYMENT").contains(type)||limit<1||limit>100)throw new IllegalArgumentException();
   Long auction=null;if(id!=null&&!id.isEmpty()){if(!id.matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException();auction=Long.parseLong(id);}
   var start=time(from);var end=time(to);if(start!=null&&end!=null&&!start.isBefore(end))throw new IllegalArgumentException();
   return new SystemWalletFilters(auction,type,start,end,limit);
  }catch(RuntimeException e){throw new WalletException(400,"INVALID_FILTER");}
 }
 private static LocalDateTime time(String value){
  if(value==null||value.isEmpty())return null;if(value.length()>40)throw new IllegalArgumentException();
  var t=OffsetDateTime.parse(value).toInstant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC).toLocalDateTime();
  if(t.getYear()<1000||t.getYear()>9999)throw new IllegalArgumentException();return t;
 }
 public String key(){return auctionId+"|"+type+"|"+from+"|"+to;}
}
