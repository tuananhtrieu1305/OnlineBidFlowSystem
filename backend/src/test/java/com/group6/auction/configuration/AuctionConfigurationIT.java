package com.group6.auction.configuration;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.group6.auction.auction.configuration.*;
import com.group6.auction.auction.repository.AuctionRepository;
import com.group6.auction.product.service.*;
import com.group6.auction.realtime.room.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class AuctionConfigurationIT {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
 @Autowired AuctionConfigurationService service; @Autowired ProductService products; @Autowired AuctionRepository auctions;
 @Autowired JpaRoomDataGateway rooms; @Autowired PlatformTransactionManager manager; @MockBean Clock clock;
 String prefix="config_"+UUID.randomUUID().toString().substring(0,8),version,csrf;long product,alice,bob;MockHttpSession admin;
 @BeforeAll static void guard(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated MySQL required");}
 @BeforeEach void setup()throws Exception{
  when(clock.instant()).thenReturn(Instant.parse("2030-01-01T00:00:00Z"));
  var p=products.create(new ProductInput(prefix,null,1,null,"KEEP"),null);product=Long.parseLong(p.id());version=p.version();
  for(String name:List.of(prefix+"a",prefix+"b"))jdbc.update("INSERT INTO users(username,password_hash,role) VALUES (?,'test-unused','USER')",name);
  alice=jdbc.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+"a");bob=jdbc.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+"b");
  admin=session("ADMIN");csrf=json.readTree(mvc.perform(get("/api/auth/csrf").session(admin)).andReturn().getResponse().getContentAsString()).get("token").asText();
 }
 MockHttpSession session(String role){var s=new MockHttpSession();s.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,new SecurityContextImpl(new UsernamePasswordAuthenticationToken("admin",null,List.of(new SimpleGrantedAuthority("ROLE_"+role)))));return s;}
 @AfterEach void clean(){
  for(String table:List.of("auction_participants","bids","chat_messages","coin_transactions"))jdbc.update("DELETE FROM "+table+" WHERE auction_id IN (SELECT id FROM auctions WHERE product_id=?)",product);
  jdbc.update("DELETE FROM auctions WHERE product_id=?",product);jdbc.update("DELETE FROM products WHERE id=?",product);jdbc.update("DELETE FROM users WHERE id IN (?,?)",alice,bob);
 }
 ObjectNode body(String type,String access,boolean create){
  var n=json.createObjectNode().put("auctionType",type).put("accessType",access).put("startingPrice","100").put("startTime","2030-01-01T08:00:00+07:00").put("endTime","2030-01-01T09:00:00+07:00");
  if(type.equals("NORMAL"))n.put("minBidIncrement","10");else n.putNull("minBidIncrement");
  if(access.equals("PRIVATE"))n.put("maxParticipants",1);else n.putNull("maxParticipants");
  if(create)n.put("productId",""+product).put("productVersion",version);return n;
 }
 Map<String,Object> create(String type,String access){return service.create("admin",AuctionInput.parse(body(type,access,true),true));}
 @Test void fourCombinationsAndAdminHttpContract()throws Exception{
  mvc.perform(get("/api/admin/auctions")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/admin/auctions").session(session("USER"))).andExpect(status().isForbidden());
  mvc.perform(post("/api/admin/auctions").session(admin).contentType("application/json").content(body("NORMAL","PUBLIC",true).toString())).andExpect(status().isForbidden());
  for(String type:List.of("NORMAL","BLIND"))for(String access:List.of("PUBLIC","PRIVATE")){
   var response=mvc.perform(post("/api/admin/auctions").session(admin).header("X-CSRF-TOKEN",csrf).contentType("application/json").content(body(type,access,true).toString())).andExpect(status().isCreated()).andExpect(header().exists("ETag")).andReturn().getResponse();
   var value=json.readTree(response.getContentAsString());assertThat(value.get("status").asText()).isEqualTo("UPCOMING");assertThat(value.get("startTime").asText()).isEqualTo("2030-01-01T01:00:00Z");
   if(access.equals("PRIVATE"))assertThat(value.get("roomCode").asText()).matches("[A-Z2-9]{12}");else assertThat(value.get("roomCode").isNull()).isTrue();
   mvc.perform(get("/api/admin/auctions/"+value.get("id").asText()).session(session("USER"))).andExpect(status().isForbidden());
  }
  assertThat(products.detail(product).editable()).isFalse();
  var list=mvc.perform(get("/api/admin/auctions").param("q",prefix).param("auctionType","BLIND").session(admin)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  assertThat(json.readTree(list).get("items").size()).isEqualTo(2);assertThat(list).doesNotContain("roomCode","startingPrice","estimatedPrice");
 }
 @Test void versionTimeAndServerOwnedFieldsAreEnforced()throws Exception{
  var invalid=body("NORMAL","PUBLIC",true).put("createdBy","2");
  mvc.perform(post("/api/admin/auctions").session(admin).header("X-CSRF-TOKEN",csrf).contentType("application/json").content(invalid.toString())).andExpect(status().isBadRequest());
  var past=body("NORMAL","PUBLIC",true).put("startTime","2029-01-01T00:00:00Z");
  assertThatThrownBy(()->service.create("admin",AuctionInput.parse(past,true))).hasMessage("START_TIME_PASSED");
  var result=create("NORMAL","PUBLIC");long id=Long.parseLong((String)result.get("id"));var input=AuctionInput.parse(body("BLIND","PRIVATE",false),false);
  assertThatThrownBy(()->service.update(id,input,null)).hasMessage("VERSION_REQUIRED");
  var edited=service.update(id,input,(String)result.get("version"));assertThat(edited.get("roomCode")).isNotNull();
  assertThatThrownBy(()->service.update(id,input,(String)result.get("version"))).hasMessage("AUCTION_CHANGED");
  when(clock.instant()).thenReturn(Instant.parse("2030-01-01T01:00:00Z"));
  assertThat(service.detail(id).get("editable")).isEqualTo(false);
  assertThatThrownBy(()->service.update(id,input,(String)edited.get("version"))).hasMessage("START_TIME_REACHED");
 }
 @Test void staleProductVersionPreventsCreation(){
  products.update(product,new ProductInput(prefix+" revised",null,2,null,"KEEP"),version,null);
  assertThatThrownBy(()->create("NORMAL","PUBLIC")).hasMessage("PRODUCT_CHANGED");
 }
 @Test void concurrentJoinCapacityAndReconnect()throws Exception{
  var a=create("BLIND","PRIVATE");long id=Long.parseLong((String)a.get("id"));String code=(String)a.get("roomCode");
  assertThat(rooms.authorizeAndRegister(alice,id,"wrong").errorCode()).isEqualTo("ROOM_CODE_INVALID");
  var barrier=new CyclicBarrier(2);
  try(var executor=Executors.newFixedThreadPool(2)){
   var one=executor.submit(()->{barrier.await();return rooms.authorizeAndRegister(alice,id,code);});
   var two=executor.submit(()->{barrier.await();return rooms.authorizeAndRegister(bob,id,code);});
   var r1=one.get(10,TimeUnit.SECONDS);var r2=two.get(10,TimeUnit.SECONDS);
   assertThat(List.of(r1.allowed(),r2.allowed())).containsExactlyInAnyOrder(true,false);
   assertThat(rooms.authorizeAndRegister(r1.allowed()?alice:bob,id,code).allowed()).isTrue();
   assertThat(rooms.countParticipants(id)).isEqualTo(1);
  }
  assertThatThrownBy(()->service.update(id,AuctionInput.parse(body("BLIND","PRIVATE",false),false),(String)a.get("version"))).hasMessage("AUCTION_HAS_ACTIVITY");
 }
 @Test void joinWinsBeforeEditWithSharedAuctionLock()throws Exception{
  var a=create("NORMAL","PUBLIC");long id=Long.parseLong((String)a.get("id"));
  var locked=new CountDownLatch(1);var release=new CountDownLatch(1);var tx=new TransactionTemplate(manager);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
  try(var executor=Executors.newFixedThreadPool(2)){
   var join=executor.submit(()->tx.execute(s->{auctions.findForUpdate(id).orElseThrow();locked.countDown();try{release.await(5,TimeUnit.SECONDS);}catch(InterruptedException e){throw new RuntimeException(e);}return rooms.authorizeAndRegister(alice,id,null);}));
   assertThat(locked.await(5,TimeUnit.SECONDS)).isTrue();
   var edit=executor.submit(()->service.update(id,AuctionInput.parse(body("BLIND","PRIVATE",false),false),(String)a.get("version")));
   release.countDown();assertThat(join.get(10,TimeUnit.SECONDS).allowed()).isTrue();
   assertThatThrownBy(()->edit.get(10,TimeUnit.SECONDS)).hasCauseInstanceOf(AuctionConfigurationException.class);
   assertThat(service.detail(id).get("accessType")).isEqualTo("PUBLIC");
  }
 }
 @Test void onlyOneConcurrentEditorWins()throws Exception{
  var a=create("NORMAL","PUBLIC");long id=Long.parseLong((String)a.get("id"));var barrier=new CyclicBarrier(2);
  try(var executor=Executors.newFixedThreadPool(2)){
   Callable<Boolean> edit=()->{barrier.await();try{service.update(id,AuctionInput.parse(body("BLIND","PRIVATE",false),false),(String)a.get("version"));return true;}catch(AuctionConfigurationException e){assertThat(e.status()).isEqualTo(412);return false;}};
   var one=executor.submit(edit);var two=executor.submit(edit);assertThat(List.of(one.get(10,TimeUnit.SECONDS),two.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
  }
 }
}
