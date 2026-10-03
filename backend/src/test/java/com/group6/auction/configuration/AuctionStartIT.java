package com.group6.auction.configuration;

import com.group6.auction.auction.lifecycle.AuctionStartService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties="app.auctions.auto-start=false")
@Transactional
class AuctionStartIT {
 @Autowired JdbcTemplate jdbc;
 @Autowired AuctionStartService service;
 long product;
 final LocalDateTime now=LocalDateTime.of(2031,1,1,0,0);
 @BeforeAll static void guard(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated MySQL required");}
 @BeforeEach void setup(){
  String name="start_"+UUID.randomUUID();
  jdbc.update("INSERT INTO products(name,quantity) VALUES (?,1)",name);
  product=jdbc.queryForObject("SELECT id FROM products WHERE name=?",Long.class,name);
 }
 long auction(String type,String access,String status,LocalDateTime start,LocalDateTime end){
  jdbc.update("INSERT INTO auctions(product_id,created_by,auction_type,access_type,status,starting_price,min_bid_increment,start_time,end_time,room_code) VALUES (?,1,?,?,?,?,?,?,?,?)",
    product,type,access,status,100,"NORMAL".equals(type)?10:null,start,end,"PRIVATE".equals(access)?UUID.randomUUID().toString().substring(0,12):null);
  return jdbc.queryForObject("SELECT MAX(id) FROM auctions WHERE product_id=?",Long.class,product);
 }
 String status(long id){return jdbc.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,id);}
 @Test void startsDueNormalAndBlindPublicAndPrivateAndIsIdempotent(){
  List<Long> ids=new ArrayList<>();
  for(String type:List.of("NORMAL","BLIND"))for(String access:List.of("PUBLIC","PRIVATE"))
   ids.add(auction(type,access,"UPCOMING",now,now.plusHours(1)));
  service.startDue(now);
  ids.forEach(id->assertThat(status(id)).isEqualTo("RUNNING"));
  service.startDue(now);
  ids.forEach(id->assertThat(status(id)).isEqualTo("RUNNING"));
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id IN (SELECT id FROM auctions WHERE product_id=?)",Long.class,product)).isZero();
 }
 @Test void neverStartsFutureExpiredOrFinishedAuctions(){
  long future=auction("NORMAL","PUBLIC","UPCOMING",now.plusSeconds(1),now.plusHours(1));
  long expired=auction("NORMAL","PUBLIC","UPCOMING",now.minusHours(1),now);
  long sold=auction("NORMAL","PUBLIC","SOLD",now.minusHours(1),now.plusHours(1));
  long unsold=auction("BLIND","PUBLIC","UNSOLD",now.minusHours(1),now.plusHours(1));
  service.startDue(now);
  assertThat(status(future)).isEqualTo("UPCOMING");assertThat(status(expired)).isEqualTo("UPCOMING");
  assertThat(status(sold)).isEqualTo("SOLD");assertThat(status(unsold)).isEqualTo("UNSOLD");
 }
}
