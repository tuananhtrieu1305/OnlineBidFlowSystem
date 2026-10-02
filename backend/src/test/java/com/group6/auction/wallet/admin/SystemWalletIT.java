package com.group6.auction.wallet.admin;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc @Transactional
class SystemWalletIT {
 @Autowired MockMvc mvc;@Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired SystemWalletQueryService service;
 long wallet;
 @BeforeAll static void guard(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");}
 @BeforeEach void fixture(){
  jdbc.update("DELETE FROM coin_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE wallet_type='SYSTEM')");jdbc.update("DELETE FROM wallets WHERE wallet_type='SYSTEM'");
  jdbc.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES(NULL,'SYSTEM',123,0,'2030-01-01')");wallet=jdbc.queryForObject("SELECT id FROM wallets WHERE wallet_type='SYSTEM'",Long.class);
 }
 MockHttpSession session(String role){var s=new MockHttpSession();s.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,new SecurityContextImpl(new UsernamePasswordAuthenticationToken("admin",null,List.of(new SimpleGrantedAuthority("ROLE_"+role)))));return s;}
 void entry(String type,long amount,String date){jdbc.update("INSERT INTO coin_transactions(wallet_id,transaction_type,available_delta,locked_delta,created_at) VALUES (?,?,?,0,?)",wallet,type,amount,date);}
 @Test void authorityAndMissingDuplicateWallet()throws Exception{
  for(String path:List.of("/api/admin/system-wallet","/api/admin/system-wallet/transactions")){mvc.perform(get(path)).andExpect(status().isUnauthorized());mvc.perform(get(path).session(session("USER"))).andExpect(status().isForbidden());}
  mvc.perform(get("/api/admin/system-wallet").session(session("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.walletId").value(""+wallet));
  jdbc.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES(NULL,'SYSTEM',0,0,'2030-01-01')");
  mvc.perform(get("/api/admin/system-wallet").session(session("ADMIN"))).andExpect(status().isConflict());
  jdbc.update("DELETE FROM wallets WHERE wallet_type='SYSTEM'");mvc.perform(get("/api/admin/system-wallet/transactions").session(session("ADMIN"))).andExpect(status().isConflict());
 }
 @Test void totalsAreExactIndependentOfBalanceAndFilters()throws Exception{
  entry("PAYMENT",Long.MAX_VALUE,"2030-01-01");entry("PAYMENT",Long.MAX_VALUE,"2030-01-01");entry("PAYMENT",-5,"2030-01-01");entry("DEPOSIT",10,"2030-01-01");
  var s=service.summary();assertThat(s.totalReceivedCoin()).isEqualTo("18446744073709551614");assertThat(s.availableBalance()).isEqualTo("123");
  mvc.perform(get("/api/admin/system-wallet/transactions").param("type","DEPOSIT").session(session("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
  assertThat(service.summary()).extracting(SystemWalletQueryService.Summary::availableBalance).isEqualTo("123");
 }
 @Test void utcBoundariesCursorAndValidation()throws Exception{
  entry("PAYMENT",1,"2030-01-01 00:00:00.123456");entry("PAYMENT",2,"2030-01-01 00:00:00.123456");entry("PAYMENT",3,"2030-01-02 00:00:00");
  var f=SystemWalletFilters.parse(null,"PAYMENT","2030-01-01T07:00:00+07:00","2030-01-02T00:00:00Z",1);var first=service.history(f,null);assertThat(first.items()).hasSize(1);var second=service.history(f,first.nextCursor());assertThat(second.items()).hasSize(1);assertThat(second.nextCursor()).isNull();assertThat(second.items().getFirst().id()).isNotEqualTo(first.items().getFirst().id());
  assertThatThrownBy(()->service.history(SystemWalletFilters.parse(null,"",null,null,20),first.nextCursor())).hasMessage("INVALID_CURSOR");
  for(String query:List.of("cursor=bad","limit=0","limit=abc","type=BAD","auctionId=9223372036854775808","from=2030-01-01"))mvc.perform(get("/api/admin/system-wallet/transactions?"+query).session(session("ADMIN"))).andExpect(status().isBadRequest());
  assertThat(service.history(SystemWalletFilters.parse("9223372036854775807","",null,null,20),null).items()).isEmpty();
 }
}
