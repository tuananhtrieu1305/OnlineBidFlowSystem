package com.group6.auction.product;
import com.fasterxml.jackson.databind.*;
import com.group6.auction.product.service.*;
import com.group6.auction.product.repository.ProductRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.*;
import org.springframework.test.context.*;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductIT {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
 @Autowired ProductService service; @Autowired ProductRepository products; @Autowired PlatformTransactionManager manager;
 @Autowired ProductImageStorage images;
 static Path root;
 static {try{root=Files.createTempDirectory("obf-product-it-");}catch(IOException ex){throw new ExceptionInInitializerError(ex);}}
 @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){registry.add("app.products.image-dir",()->root.toString());}
 MockHttpSession admin;String csrf;String prefix="product_"+UUID.randomUUID();
 @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated MySQL required");}
 @BeforeEach void setup() throws Exception {
  admin=session("ADMIN");
  csrf=json.readTree(mvc.perform(get("/api/auth/csrf").session(admin)).andReturn().getResponse().getContentAsString()).get("token").asText();
 }
 MockHttpSession session(String role){
  var s=new MockHttpSession();s.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,new SecurityContextImpl(new UsernamePasswordAuthenticationToken("test-admin",null,List.of(new SimpleGrantedAuthority("ROLE_"+role)))));return s;
 }
 @AfterEach void clean(){
  jdbc.update("DELETE FROM auctions WHERE product_id IN (SELECT id FROM products WHERE name LIKE ?)",prefix+"%");
  jdbc.update("DELETE FROM products WHERE name LIKE ?",prefix+"%");
 }
 @AfterAll static void files() throws IOException {try(var paths=Files.walk(root)){for(var p:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}}
 MockMultipartFile data(String suffix,boolean update) throws Exception {
  var node=json.createObjectNode().put("name",prefix+suffix).put("quantity",2).put("estimatedPrice","9007199254740993");
  if(update)node.put("imageAction","KEEP");
  return new MockMultipartFile("data","","application/json",json.writeValueAsBytes(node));
 }
 MockMultipartFile image() throws Exception {var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(3,2,BufferedImage.TYPE_INT_RGB),"png",bytes);return new MockMultipartFile("image","../../evil.png","image/png",bytes.toByteArray());}
 JsonNode create(boolean withImage) throws Exception {
  var request=multipart("/api/admin/products").file(data("",false));
  if(withImage)request.file(image());
  request.session(admin).header("X-CSRF-TOKEN",csrf);
  return json.readTree(mvc.perform(request).andExpect(status().isCreated()).andExpect(header().exists("ETag")).andReturn().getResponse().getContentAsString());
 }
 @Test void ownershipCsrfInputAndImageValidation() throws Exception {
  mvc.perform(get("/api/admin/products")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/admin/products").session(session("USER"))).andExpect(status().isForbidden());
  mvc.perform(multipart("/api/admin/products").file(data("",false)).session(admin)).andExpect(status().isForbidden());
  mvc.perform(multipart("/api/admin/products").file(data("",false)).file(new MockMultipartFile("image","fake.png","image/png","<svg/>".getBytes())).session(admin).header("X-CSRF-TOKEN",csrf)).andExpect(status().isUnsupportedMediaType());
  mvc.perform(get("/api/admin/products?size=101").session(admin)).andExpect(status().isBadRequest());
  mvc.perform(get("/api/admin/products/not-id").session(admin)).andExpect(status().isBadRequest());
  mvc.perform(get("/api/admin/products/9223372036854775807").session(admin)).andExpect(status().isNotFound());
  mvc.perform(get("/api/product-images/secret.txt")).andExpect(status().isNotFound());
 }
 @Test void createReadEditAndStaleFormWithRealImage() throws Exception {
  var original=create(true);String id=original.get("id").asText(),etag=original.get("version").asText();
  mvc.perform(get(original.get("imageUrl").asText())).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
  mvc.perform(get("/api/admin/products/"+id).session(admin)).andExpect(status().isOk()).andExpect(header().string("ETag",etag));
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(data(" updated",true)).session(admin).header("X-CSRF-TOKEN",csrf)).andExpect(status().is(428));
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(data(" updated",true)).session(admin).header("X-CSRF-TOKEN",csrf).header("If-Match",etag)).andExpect(status().isOk());
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(data(" stale",true)).session(admin).header("X-CSRF-TOKEN",csrf).header("If-Match",etag)).andExpect(status().isPreconditionFailed());
  var result=json.readTree(mvc.perform(get("/api/admin/products").param("q",prefix).param("size","1").session(admin)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
  assertThat(result.get("items").get(0).get("name").asText()).endsWith("updated");
  assertThat(result.get("items").get(0).get("estimatedPrice").asText()).isEqualTo("9007199254740993");
  assertThat(service.list("%",0,20).items()).noneMatch(p->p.name().startsWith(prefix));
 }
 void attach(long id){jdbc.update("INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,min_bid_increment,start_time,end_time,status) VALUES (?,(SELECT MIN(id) FROM users WHERE role='ADMIN'),'NORMAL','PUBLIC',100,10,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),'UPCOMING')",id);}
 @Test void usedProductCannotChange() throws Exception {
  var p=create(false);long id=p.get("id").asLong();attach(id);
  assertThat(service.detail(id).editable()).isFalse();
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(data(" illegal",true)).session(admin).header("X-CSRF-TOKEN",csrf).header("If-Match",p.get("version").asText())).andExpect(status().isConflict());
 }
 @Test void rollbackRemovesPublishedImageAndImageActionsPersist() throws Exception {
  var staged=images.stage(image());var tx=new TransactionTemplate(manager);
  assertThatThrownBy(()->tx.executeWithoutResult(s->{service.create(new ProductInput(prefix,null,1,null,"KEEP"),staged);throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
  assertThat(Files.exists(root.resolve(staged.filename()))).isFalse();
  assertThat(service.list(prefix,0,20).items()).isEmpty();
  var p=create(true);String id=p.get("id").asText();
  var node=json.createObjectNode().put("name",prefix).put("quantity",1).put("imageAction","REMOVE");
  var request=new MockMultipartFile("data","","application/json",json.writeValueAsBytes(node));
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(request).session(admin).header("X-CSRF-TOKEN",csrf).header("If-Match",p.get("version").asText())).andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").isEmpty());
  node.put("imageAction","REPLACE");request=new MockMultipartFile("data","","application/json",json.writeValueAsBytes(node));
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(request).session(admin).header("X-CSRF-TOKEN",csrf).header("If-Match",service.detail(Long.parseLong(id)).version())).andExpect(status().isBadRequest());
  mvc.perform(multipart(org.springframework.http.HttpMethod.PUT,"/api/admin/products/"+id).file(request).file(image()).session(admin).header("X-CSRF-TOKEN",csrf).header("If-Match",service.detail(Long.parseLong(id)).version())).andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").isNotEmpty());
 }
 @Test void concurrentEditorsOnlyOneWins() throws Exception {
  var p=create(false);long id=p.get("id").asLong();String version=p.get("version").asText();
  var barrier=new CyclicBarrier(2);
  try(var executor=Executors.newFixedThreadPool(2)){
   Callable<Boolean> edit=()->{barrier.await(5,TimeUnit.SECONDS);try{service.update(id,new ProductInput(prefix+UUID.randomUUID(),null,1,null,"KEEP"),version,null);return true;}catch(ProductException ex){assertThat(ex.status()).isEqualTo(412);return false;}};
   var a=executor.submit(edit);var b=executor.submit(edit);
   assertThat(List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
  }
 }
 @Test void auctionAttachmentSerializesAgainstEdit() throws Exception {
  var p=create(false);long id=p.get("id").asLong();var locked=new CountDownLatch(1);var finish=new CountDownLatch(1);
  var tx=new TransactionTemplate(manager);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
  try(var executor=Executors.newFixedThreadPool(2)){
   var attaching=executor.submit(()->tx.executeWithoutResult(s->{products.findForUpdate(id).orElseThrow();locked.countDown();try{finish.await(5,TimeUnit.SECONDS);}catch(InterruptedException ex){throw new RuntimeException(ex);}attach(id);}));
   assertThat(locked.await(5,TimeUnit.SECONDS)).isTrue();
   var editing=executor.submit(()->service.update(id,new ProductInput(prefix+" blocked",null,1,null,"KEEP"),p.get("version").asText(),null));
   finish.countDown();attaching.get(10,TimeUnit.SECONDS);
   assertThatThrownBy(()->editing.get(10,TimeUnit.SECONDS)).hasCauseInstanceOf(ProductException.class);
   assertThat(service.detail(id).name()).isEqualTo(prefix);
  }
 }
}
