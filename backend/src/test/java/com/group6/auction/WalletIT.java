package com.group6.auction;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class WalletIT {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 @Autowired ObjectMapper json;
 String username="wallet_"+UUID.randomUUID().toString().replace("-","");
 String cookie="",csrf="";
 @BeforeAll static void isolated() { if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE"))) throw new IllegalStateException("Isolated database required"); }
 @AfterEach void clean() {
  jdbc.update("DELETE FROM coin_transactions WHERE wallet_id IN (SELECT w.id FROM wallets w JOIN users u ON u.id=w.user_id WHERE u.username=?)",username);
  jdbc.update("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE username=?)",username);
  jdbc.update("DELETE FROM users WHERE username=?",username);
 }
 HttpResponse<String> call(String method,String route,String body) throws Exception {
  var b=HttpRequest.newBuilder(URI.create("http://localhost:"+port+route)).header("Content-Type","application/json");
  if(!cookie.isEmpty()) b.header("Cookie",cookie);
  if(!csrf.isEmpty()) b.header("X-CSRF-TOKEN",csrf);
  try(var c=HttpClient.newHttpClient()) {
   var r=c.send(b.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
   r.headers().firstValue("set-cookie").ifPresent(v->cookie=v.split(";")[0]); return r;
  }
 }
 void login() throws Exception {
  String credentials="{\"username\":\""+username+"\",\"password\":\"test-password-123\"}";
  assertThat(call("POST","/api/auth/register",credentials).statusCode()).isEqualTo(201);
  csrf=json.readTree(call("GET","/api/auth/csrf",null).body()).get("token").asText();
  assertThat(call("POST","/api/auth/login",credentials).statusCode()).isEqualTo(200);
  csrf=json.readTree(call("GET","/api/auth/csrf",null).body()).get("token").asText();
 }
 @Test void depositAndHistoryAreOwnedAndValidated() throws Exception {
  assertThat(call("GET","/api/wallet",null).statusCode()).isEqualTo(401);
  login();
  var initial=call("GET","/api/wallet",null);
  assertThat(initial.statusCode()).isEqualTo(200);
  assertThat(initial.body()).contains("\"availableBalance\":\"0\"");
  assertThat(call("GET","/api/wallet?userId=1&walletId=1",null).body()).isEqualTo(initial.body());
  assertThat(call("POST","/api/wallet/deposits","{\"amount\":\"1250\"}").statusCode()).isEqualTo(201);
  assertThat(call("GET","/api/wallet",null).body()).contains("\"availableBalance\":\"1250\"");
  var history=call("GET","/api/wallet/transactions?limit=1",null);
  assertThat(history.statusCode()).isEqualTo(200);
  assertThat(history.body()).contains("DEPOSIT","\"availableDelta\":\"1250\"");
  for(String amount:new String[]{"0","-1","1.5","9223372036854775808"}) {
   assertThat(call("POST","/api/wallet/deposits","{\"amount\":\""+amount+"\"}").statusCode()).isEqualTo(400);
  }
  assertThat(call("POST","/api/wallet/deposits","{\"amount\":\"10\",\"userId\":1}").statusCode()).isEqualTo(400);
  assertThat(call("GET","/api/wallet/transactions?type=INVALID",null).statusCode()).isEqualTo(400);
  assertThat(call("POST","/api/wallet/deposits","{\"amount\":\"50\"}").statusCode()).isEqualTo(201);
  var first=json.readTree(call("GET","/api/wallet/transactions?limit=1",null).body());
  String cursor=first.get("nextCursor").asText();
  var next=call("GET","/api/wallet/transactions?limit=1&cursor="+cursor,null);
  assertThat(next.statusCode()).isEqualTo(200);
  assertThat(json.readTree(next.body()).get("items").get(0).get("id").asText()).describedAs("first=%s next=%s", first, next.body()).isNotEqualTo(first.get("items").get(0).get("id").asText());
  csrf="";
  assertThat(call("POST","/api/wallet/deposits","{\"amount\":\"10\"}").statusCode()).isEqualTo(403);
 }
 @Test void adminCannotAccessPersonalWallet() throws Exception {
  login();
  jdbc.update("UPDATE users SET role='ADMIN' WHERE username=?",username);
  assertThat(call("POST","/api/auth/login","{\"username\":\""+username+"\",\"password\":\"test-password-123\"}").statusCode()).isEqualTo(200);
  assertThat(call("GET","/api/wallet",null).statusCode()).isEqualTo(403);
  assertThat(call("GET","/api/wallet/transactions",null).statusCode()).isEqualTo(403);
 }
}
