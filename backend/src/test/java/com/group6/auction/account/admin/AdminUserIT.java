package com.group6.auction.account.admin;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class AdminUserIT {
 @Autowired MockMvc mvc;@Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;
 String prefix="users_"+UUID.randomUUID().toString().substring(0,8);long user,missing,admin,wallet;
 @BeforeAll static void guard(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated database required");}
 @BeforeEach void setup(){
  for(String suffix:List.of("a","b","c"))jdbc.update("INSERT INTO users(username,password_hash,role) VALUES (?,'private-test-hash',?)",prefix+suffix,suffix.equals("c")?"ADMIN":"USER");
  user=id("a");missing=id("b");admin=id("c");
  jdbc.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES (?,'USER',9007199254740993,0,'2026-10-01 00:00:00')",user);
  wallet=jdbc.queryForObject("SELECT id FROM wallets WHERE user_id=?",Long.class,user);
  for(int i=0;i<3;i++)jdbc.update("INSERT INTO coin_transactions(wallet_id,auction_id,transaction_type,available_delta,locked_delta,created_at) VALUES (?,NULL,'DEPOSIT',100,0,'2026-10-01 00:00:00')",wallet);
 }
 long id(String suffix){return jdbc.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+suffix);}
 @AfterEach void cleanup(){jdbc.update("DELETE FROM coin_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (?,?))",user,missing);jdbc.update("DELETE FROM wallets WHERE user_id IN (?,?)",user,missing);jdbc.update("DELETE FROM users WHERE id IN (?,?,?)",user,missing,admin);}
 MockHttpSession session(String role){var s=new MockHttpSession();s.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,new SecurityContextImpl(new UsernamePasswordAuthenticationToken(prefix+"c",null,List.of(new SimpleGrantedAuthority("ROLE_"+role)))));return s;}
 JsonNode read(String path)throws Exception{return json.readTree(mvc.perform(get(path).session(session("ADMIN"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
 @Test void permissionsAndWalletStates()throws Exception{
  for(String path:List.of("/api/admin/users","/api/admin/users/"+user,"/api/admin/users/"+user+"/transactions")){
   mvc.perform(get(path)).andExpect(status().isUnauthorized());mvc.perform(get(path).session(session("USER"))).andExpect(status().isForbidden());
  }
  var detail=read("/api/admin/users/"+user);assertThat(detail.get("walletState").asText()).isEqualTo("AVAILABLE");assertThat(detail.path("wallet").path("availableBalance").asText()).isEqualTo("9007199254740993");assertThat(detail.toString()).doesNotContain("password","private-test-hash");
  assertThat(read("/api/admin/users/"+missing).get("walletState").asText()).isEqualTo("MISSING");assertThat(read("/api/admin/users/"+admin).get("walletState").asText()).isEqualTo("NOT_APPLICABLE");
  mvc.perform(get("/api/admin/users/"+missing+"/transactions").session(session("ADMIN"))).andExpect(status().isConflict());
  mvc.perform(get("/api/admin/users/"+admin+"/transactions").session(session("ADMIN"))).andExpect(status().isConflict());
 }
 @Test void filtersPaginationAndBoundaries()throws Exception{
  var list=read("/api/admin/users?q="+prefix+"&role=USER&size=1");assertThat(list.path("totalElements").asText()).isEqualTo("2");assertThat(list.path("items").size()).isEqualTo(1);assertThat(list.toString()).doesNotContain("password");
  assertThat(read("/api/admin/users?q="+user).path("items").toString()).contains(prefix+"a");
  mvc.perform(get("/api/admin/users").param("q","%_' OR 1=1").session(session("ADMIN"))).andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("\"totalElements\":\"0\"")));
  for(String query:List.of("role=ROOT","page=-1","size=101","page=2147483647&size=100","page=no"))mvc.perform(get("/api/admin/users?"+query).session(session("ADMIN"))).andExpect(status().isBadRequest());
  for(String value:List.of("0","-1","9223372036854775808","abc"))mvc.perform(get("/api/admin/users/"+value).session(session("ADMIN"))).andExpect(status().isBadRequest());
  mvc.perform(get("/api/admin/users/9223372036854775807").session(session("ADMIN"))).andExpect(status().isNotFound());
 }
 @Test void historyUsesStableCursorAndNeverWrites()throws Exception{
  var first=read("/api/admin/users/"+user+"/transactions?limit=2");assertThat(first.path("items").size()).isEqualTo(2);
  var next=read("/api/admin/users/"+user+"/transactions?limit=2&cursor="+first.get("nextCursor").asText());assertThat(next.path("items").size()).isEqualTo(1);assertThat(next.get("nextCursor").isNull()).isTrue();assertThat(next.path("items").get(0).get("id")).isNotEqualTo(first.path("items").get(0).get("id"));
  jdbc.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES (?,'USER',0,0,'2026-10-01 00:00:00')",missing);
  assertThat(read("/api/admin/users/"+missing).path("wallet").path("availableBalance").asText()).isEqualTo("0");
  assertThat(read("/api/admin/users/"+missing+"/transactions?cursor="+first.get("nextCursor").asText()).path("items").size()).isZero();
  for(String query:List.of("cursor=garbage","type=BAD","limit=0"))mvc.perform(get("/api/admin/users/"+user+"/transactions?"+query).session(session("ADMIN"))).andExpect(status().isBadRequest());
  assertThat(jdbc.queryForObject("SELECT available_balance FROM wallets WHERE id=?",String.class,wallet)).isEqualTo("9007199254740993");assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE wallet_id=?",Integer.class,wallet)).isEqualTo(3);
 }
}
