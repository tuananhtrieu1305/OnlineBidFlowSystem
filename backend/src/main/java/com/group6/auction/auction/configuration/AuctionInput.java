package com.group6.auction.auction.configuration;
import com.fasterxml.jackson.databind.JsonNode;
import com.group6.auction.auction.entity.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
public record AuctionInput(Long productId,String productVersion,AuctionType type,AuctionAccessType access,long price,Long increment,Integer capacity,LocalDateTime start,LocalDateTime end) {
 public static AuctionInput parse(JsonNode node,boolean create){
  try{
   if(node==null||!node.isObject())throw new IllegalArgumentException();
   var fields=new HashSet<>(Set.of("auctionType","accessType","startingPrice","minBidIncrement","maxParticipants","startTime","endTime"));
   if(create)fields.addAll(Set.of("productId","productVersion"));
   node.fieldNames().forEachRemaining(key->{if(!fields.contains(key))throw new IllegalArgumentException();});
   var type=AuctionType.valueOf(text(node,"auctionType"));var access=AuctionAccessType.valueOf(text(node,"accessType"));
   long price=amount(node.get("startingPrice"));Long increment=null;Integer capacity=null;
   if(type==AuctionType.NORMAL){increment=amount(node.get("minBidIncrement"));Math.addExact(price,increment);}
   else if(!node.has("minBidIncrement")||!node.get("minBidIncrement").isNull())throw new IllegalArgumentException();
   var max=node.get("maxParticipants");
   if(max==null)throw new IllegalArgumentException();
   if(!max.isNull()){if(access!=AuctionAccessType.PRIVATE||!max.isIntegralNumber()||!max.canConvertToInt()||max.intValue()<1)throw new IllegalArgumentException();capacity=max.intValue();}
   LocalDateTime start=time(text(node,"startTime")),end=time(text(node,"endTime"));
   if(!end.isAfter(start))throw new IllegalArgumentException();
   String version=create?text(node,"productVersion"):null;
   if(create&&(version.isBlank()||version.length()>128))throw new IllegalArgumentException();
   return new AuctionInput(create?amount(node.get("productId")):null,version,type,access,price,increment,capacity,start,end);
  }catch(RuntimeException ex){throw new AuctionConfigurationException(400,"INVALID_AUCTION_CONFIGURATION");}
 }
 private static String text(JsonNode n,String key){var v=n.get(key);if(v==null||!v.isTextual())throw new IllegalArgumentException();return v.textValue();}
 private static long amount(JsonNode n){if(n==null||!n.isTextual()||!n.textValue().matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException();return Long.parseLong(n.textValue());}
 private static LocalDateTime time(String text){
  if(text.length()>40)throw new IllegalArgumentException();
  var utc=OffsetDateTime.parse(text).toInstant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC).toLocalDateTime();
  if(utc.getYear()<1000||utc.getYear()>9999)throw new IllegalArgumentException();return utc;
 }
}
