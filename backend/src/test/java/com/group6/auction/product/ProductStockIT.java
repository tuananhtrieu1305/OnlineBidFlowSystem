package com.group6.auction.product;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.product.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductStockIT {
    @Autowired ProductService products;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    final String prefix="stock_"+UUID.randomUUID().toString().replace("-","");
    final List<Long> productIds=new ArrayList<>(), auctionIds=new ArrayList<>(), sessions=new ArrayList<>();
    long admin,winner;
    @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated MySQL required");}
    @BeforeEach void setup(){
        db.update("INSERT INTO users(username,password_hash,role) VALUES(?,'unused-test-hash','ADMIN'),(?,'unused-test-hash','USER')",prefix+"admin",prefix+"winner");
        admin=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+"admin");
        winner=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+"winner");
    }
    long product(String suffix,int quantity){
        long id=Long.parseLong(products.create(new ProductInput(prefix+suffix,null,quantity,null,"KEEP"),null).id());productIds.add(id);return id;
    }
    long auction(long product,String type,String status){
        db.update("""
            INSERT INTO auctions(product_id,created_by,auction_type,access_type,starting_price,min_bid_increment,
            start_time,end_time,status,winner_user_id,winning_price,finished_at)
            VALUES(?,?,?,'PUBLIC',100,?,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),?,?,?,?)
            """,product,admin,type,type.equals("NORMAL")?10:null,status,status.equals("SOLD")?winner:null,
                status.equals("SOLD")?100:null,Set.of("SOLD","UNSOLD").contains(status)?java.time.LocalDateTime.now(java.time.ZoneOffset.UTC):null);
        long id=db.queryForObject("SELECT MAX(id) FROM auctions WHERE product_id=?",Long.class,product);auctionIds.add(id);return id;
    }
    long live(long product,String status){
        long auction=auction(product,"LIVESTREAM","UNSOLD");
        String request=UUID.randomUUID().toString();
        db.update("INSERT INTO livestream_sessions(host_id,create_request_id,title,description,starts_at,status) VALUES(?,?,?,'',UTC_TIMESTAMP(6),?)",admin,request,prefix,status);
        long id=db.queryForObject("SELECT id FROM livestream_sessions WHERE host_id=? AND create_request_id=?",Long.class,admin,request);sessions.add(id);
        db.update("INSERT INTO livestream_lots(session_id,auction_id,position,phase) VALUES(?,?,0,'UNSOLD')",id,auction);return id;
    }
    Set<String> available(){return products.list(prefix,0,100,true).items().stream().map(p->p.id()).collect(java.util.stream.Collectors.toSet());}
    @AfterEach void clean(){
        for(long id:sessions){db.update("DELETE FROM livestream_lots WHERE session_id=?",id);db.update("DELETE FROM livestream_sessions WHERE id=?",id);}
        for(long id:auctionIds)db.update("DELETE FROM auctions WHERE id=?",id);
        for(long id:productIds)db.update("DELETE FROM products WHERE id=?",id);
        db.update("DELETE FROM users WHERE id IN (?,?)",admin,winner);
    }
    @Test void filtersConsumedStockBeforePaginationButKeepsProductsWithRemainingUnits() throws Exception {
        long free=product("free",1);
        long upcoming=product("upcoming",1);auction(upcoming,"NORMAL","UPCOMING");
        long running=product("running",1);auction(running,"BLIND","RUNNING");
        long sold=product("sold",1);auction(sold,"NORMAL","SOLD");
        long unsold=product("unsold",1);auction(unsold,"NORMAL","UNSOLD");
        long partial=product("partial",3);auction(partial,"NORMAL","SOLD");auction(partial,"BLIND","RUNNING");
        long exhausted=product("exhausted",2);auction(exhausted,"NORMAL","SOLD");auction(exhausted,"NORMAL","UPCOMING");
        assertThat(available()).containsExactlyInAnyOrder(""+free,""+unsold,""+partial);
        assertThat(products.list(prefix,0,100).items()).hasSize(7);
        for(int page=0;page<3;page++) {
            var result=products.list(prefix,page,1,true);assertThat(result.items()).hasSize(1);
            assertThat(result.totalElements()).isEqualTo("3");assertThat(result.totalPages()).isEqualTo(3);
        }
        var session=new MockHttpSession();session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
            new SecurityContextImpl(new UsernamePasswordAuthenticationToken("inventory-admin",null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))));
        var response=mvc.perform(get("/api/admin/products").param("q",prefix).param("availableOnly","true").param("size","1").session(session)).andExpect(status().isOk()).andReturn().getResponse();
        var body=json.readTree(response.getContentAsString());assertThat(body.path("totalElements").asText()).isEqualTo("3");
        assertThat(body.path("items").size()).isEqualTo(1);
    }
    @Test void unsoldLotsStayReservedUntilTheirLiveSessionEnds() {
        long scheduled=product("scheduled",1);long session=live(scheduled,"SCHEDULED");
        long paused=product("paused",1);live(paused,"PAUSED");
        long released=product("released",1);live(released,"ENDED");
        long partial=product("partialLive",2);live(partial,"SCHEDULED");
        assertThat(available()).containsExactlyInAnyOrder(""+released,""+partial);
        db.update("UPDATE livestream_sessions SET status='ENDED' WHERE id=?",session);
        assertThat(available()).containsExactlyInAnyOrder(""+scheduled,""+released,""+partial);
    }
}
