package com.group6.auction.auction.configuration;
import com.fasterxml.jackson.databind.JsonNode;
import com.group6.auction.auction.entity.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
public record AuctionInput(Long productId,String productVersion,AuctionType type,AuctionAccessType access,long price,Long increment,Integer capacity,LocalDateTime start,LocalDateTime end,NormalTimingRepository.Timing normalTiming,BlindSetup blindSetup) {
 public record BlindSetup(List<String> clues,int tradeSeconds,int bidSeconds) {}
 public static AuctionInput parse(JsonNode node,boolean create){
  try{
   if(node==null||!node.isObject())throw new IllegalArgumentException();
   var fields=new HashSet<>(Set.of("auctionType","accessType","startingPrice","minBidIncrement","maxParticipants","startTime","endTime","normalTiming","blindSetup"));
   if(create)fields.addAll(Set.of("productId","productVersion"));
   node.fieldNames().forEachRemaining(key->{if(!fields.contains(key))throw new IllegalArgumentException();});
   var type=AuctionType.valueOf(text(node,"auctionType"));var access=AuctionAccessType.valueOf(text(node,"accessType"));
   long price=amount(node.get("startingPrice"));Long increment=null;Integer capacity=null;
   if(type==AuctionType.NORMAL){increment=amount(node.get("minBidIncrement"));Math.addExact(price,increment);}
   else if(!node.has("minBidIncrement")||!node.get("minBidIncrement").isNull())throw new IllegalArgumentException();
   var max=node.get("maxParticipants");
   if(max==null)throw new IllegalArgumentException();
   if(!max.isNull()){if((access!=AuctionAccessType.PRIVATE&&type!=AuctionType.BLIND)||!max.isIntegralNumber()||!max.canConvertToInt()||max.intValue()<1)throw new IllegalArgumentException();capacity=max.intValue();}
   if(type==AuctionType.BLIND&&(capacity==null||capacity<3||capacity>30))throw new IllegalArgumentException();
   LocalDateTime start=time(text(node,"startTime")),end=type==AuctionType.BLIND?start.plusMinutes(5):time(text(node,"endTime"));
   if(!end.isAfter(start))throw new IllegalArgumentException();
   String version=create?text(node,"productVersion"):null;
   if(create&&(version.isBlank()||version.length()>128))throw new IllegalArgumentException();
   NormalTimingRepository.Timing timing=NormalTimingRepository.DEFAULTS;
   var settings=node.get("normalTiming");
   if(settings!=null&&!settings.isNull()){
    if(type!=AuctionType.NORMAL||!settings.isObject())throw new IllegalArgumentException();
    settings.fieldNames().forEachRemaining(key->{if(!Set.of("closingWindowSeconds","extensionSeconds","leaderboardSeconds").contains(key))throw new IllegalArgumentException();});
    int window=seconds(settings,"closingWindowSeconds"),extension=seconds(settings,"extensionSeconds"),leaderboard=seconds(settings,"leaderboardSeconds");
    if(extension<window)throw new IllegalArgumentException();
    timing=new NormalTimingRepository.Timing(window,extension,leaderboard);
   }
   BlindSetup blind=null;var setup=node.get("blindSetup");
   if(type==AuctionType.BLIND){
    if(setup==null||!setup.isObject())throw new IllegalArgumentException();
    setup.fieldNames().forEachRemaining(key->{if(!Set.of("clues","tradeSeconds","bidSeconds").contains(key))throw new IllegalArgumentException();});
    var raw=setup.get("clues");if(raw==null||!raw.isArray()||raw.size()!=capacity)throw new IllegalArgumentException();
    List<String> clues=new ArrayList<>();
    for(var item:raw){if(!item.isTextual())throw new IllegalArgumentException();String clue=item.textValue().strip();if(clue.isEmpty()||clue.length()>500)throw new IllegalArgumentException();clues.add(clue);}
    if(new HashSet<>(clues).size()!=capacity)throw new IllegalArgumentException();
    blind=new BlindSetup(List.copyOf(clues),seconds(setup,"tradeSeconds"),seconds(setup,"bidSeconds"));
   }else if(setup!=null&&!setup.isNull())throw new IllegalArgumentException();
   return new AuctionInput(create?amount(node.get("productId")):null,version,type,access,price,increment,capacity,start,end,timing,blind);
  }catch(RuntimeException ex){throw new AuctionConfigurationException(400,"INVALID_AUCTION_CONFIGURATION");}
 }
 private static int seconds(JsonNode n,String key){var v=n.get(key);if(v==null||!v.isIntegralNumber()||!v.canConvertToInt()||v.intValue()<1||v.intValue()>3600)throw new IllegalArgumentException();return v.intValue();}
 private static String text(JsonNode n,String key){var v=n.get(key);if(v==null||!v.isTextual())throw new IllegalArgumentException();return v.textValue();}
 private static long amount(JsonNode n){if(n==null||!n.isTextual()||!n.textValue().matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException();return Long.parseLong(n.textValue());}
 private static LocalDateTime time(String text){
  if(text.length()>40)throw new IllegalArgumentException();
  var utc=OffsetDateTime.parse(text).toInstant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC).toLocalDateTime();
  if(utc.getYear()<1000||utc.getYear()>9999)throw new IllegalArgumentException();return utc;
 }
}
