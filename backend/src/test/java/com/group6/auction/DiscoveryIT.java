package com.group6.auction;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class DiscoveryIT {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
 long product,normal,blind,hidden;
 String name="discovery_"+UUID.randomUUID().toString().substring(0,8);
 @BeforeAll static void guard(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Test DB required");}
 @BeforeEach void setup(){
  jdbc.update("INSERT INTO products(name,description,quantity,estimated_price) VALUES (?,'Camera description',1,777777)",name);
  product=jdbc.queryForObject("SELECT id FROM products WHERE name=?",Long.class,name);
  normal=create("NORMAL","PUBLIC");blind=create("BLIND","PUBLIC");hidden=create("BLIND","PRIVATE");
 }
 long create(String type,String access){
  jdbc.update("INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,min_bid_increment,room_code,start_time,end_time,status) VALUES (?,1,?,?,9007199254740993,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 2 HOUR),'UPCOMING')",product,type,access,type.equals("NORMAL")?10:null,access.equals("PRIVATE")?"SECRET_ROOM":null);
  return jdbc.queryForObject("SELECT MAX(id) FROM auctions WHERE product_id=?",Long.class,product);
 }
 @AfterEach void cleanup(){jdbc.update("DELETE FROM auctions WHERE product_id=?",product);jdbc.update("DELETE FROM products WHERE id=?",product);}
 HttpResponse<String> get(String route)throws Exception {try(var c=HttpClient.newHttpClient()){return c.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+route)).GET().build(),HttpResponse.BodyHandlers.ofString());}}
 @Test void publicListAndDetailAreSafeForGuests()throws Exception {
  var r=get("/api/discovery/auctions?q="+name);assertThat(r.statusCode()).isEqualTo(200);
  var page=json.readTree(r.body());assertThat(page.get("items").size()).isEqualTo(2);
  assertThat(r.body()).doesNotContain("SECRET_ROOM","roomCode","estimatedPrice","createdBy");
  var n=json.readTree(get("/api/discovery/auctions/"+normal).body());assertThat(n.get("startingPrice").asText()).isEqualTo("9007199254740993");assertThat(n.get("startingPrice").isTextual()).isTrue();
  var b=get("/api/discovery/auctions/"+blind);assertThat(b.statusCode()).isEqualTo(200);assertThat(b.body()).contains("Camera description").doesNotContain("startingPrice","currentPrice","minBidIncrement","9007199254740993","777777");
  assertThat(get("/api/discovery/auctions/"+hidden).statusCode()).isEqualTo(404);
  assertThat(get("/api/admin/auctions").statusCode()).isEqualTo(401);
  assertThat(get("/api/auctions/"+normal+"/replay").statusCode()).isEqualTo(401);
 }
 @Test void filtersPaginationAndInvalidInput()throws Exception {
  var r=json.readTree(get("/api/discovery/auctions?q="+name+"&auctionType=NORMAL&status=UPCOMING&size=1").body());
  assertThat(r.get("items").size()).isEqualTo(1);assertThat(r.get("totalElements").asText()).isEqualTo("1");
  assertThat(get("/api/discovery/auctions?size=101").statusCode()).isEqualTo(400);
  assertThat(get("/api/discovery/auctions?status=INVALID").statusCode()).isEqualTo(400);
  assertThat(get("/api/discovery/auctions/nope").statusCode()).isEqualTo(400);
 }
 @Test void paginationUsesStableOrderAndTreatsSearchWildcardsLiterally()throws Exception {
  var first=json.readTree(get("/api/discovery/auctions?q="+name+"&size=1").body());
  var second=json.readTree(get("/api/discovery/auctions?q="+name+"&size=1&page=1").body());
  assertThat(first.get("totalPages").asInt()).isEqualTo(2);
  assertThat(first.get("items").get(0).get("id").asText()).isEqualTo(Long.toString(blind));
  assertThat(second.get("items").get(0).get("id").asText()).isEqualTo(Long.toString(normal));
  assertThat(json.readTree(get("/api/discovery/auctions?q="+name+"&page=2&size=1").body()).get("items").size()).isZero();
  for(String literal:java.util.List.of("%25","%5F","!","%27")) {
   assertThat(json.readTree(get("/api/discovery/auctions?q="+name+literal).body()).get("items").size()).isZero();
  }
  assertThat(java.time.Instant.parse(first.get("serverNow").asText())).isBefore(java.time.Instant.now().plusSeconds(5));
 }
 @Test void rejectsInvalidBoundariesAndDoesNotExposePrivateExistence()throws Exception {
  for(String query:java.util.List.of("page=-1","page=2147483647&size=100","page=abc","size=0","auctionType=invalid","q="+"x".repeat(256)))
   assertThat(get("/api/discovery/auctions?"+query).statusCode()).as(query).isEqualTo(400);
  for(String id:java.util.List.of("0","-1","9223372036854775808"))
   assertThat(get("/api/discovery/auctions/"+id).statusCode()).as(id).isEqualTo(400);
  assertThat(get("/api/discovery/auctions/9223372036854775807").statusCode()).isEqualTo(404);
 }
 @Test void runningBlindListAndDetailHideBidDataWhileNormalShowsExactCurrentPrice()throws Exception {
  jdbc.update("UPDATE auctions SET status='RUNNING' WHERE id IN (?,?)",normal,blind);
  try {
   jdbc.update("INSERT INTO bids(auction_id,user_id,amount,created_at) VALUES (?,2,9007199254741993,UTC_TIMESTAMP(6)),(?,2,888888,UTC_TIMESTAMP(6))",normal,blind);
   var n=json.readTree(get("/api/discovery/auctions/"+normal).body());
   assertThat(n.get("currentPrice").asText()).isEqualTo("9007199254741993");
   assertThat(n.get("startTime").asText()).endsWith("Z");
   for(String url:java.util.List.of("/api/discovery/auctions/"+blind,"/api/discovery/auctions?q="+name+"&auctionType=BLIND")) {
    var r=get(url);assertThat(r.statusCode()).isEqualTo(200);
    assertThat(r.body()).doesNotContain("888888","777777","startingPrice","currentPrice","minBidIncrement","highest","leader","bids","estimatedPrice","roomCode");
   }
   assertThat(n.toString()).doesNotContain("statistics","estimatedPrice","roomCode");
  } finally {jdbc.update("DELETE FROM bids WHERE auction_id IN (?,?)",normal,blind);}
 }
}
