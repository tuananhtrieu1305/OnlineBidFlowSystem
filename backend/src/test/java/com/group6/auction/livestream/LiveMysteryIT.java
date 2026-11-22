package com.group6.auction.livestream;
import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.product.service.ProductVersion;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest
class LiveMysteryIT {
    @Autowired LiveService service; @Autowired LiveQueries queries; @Autowired JdbcTemplate db;
    @Autowired ProductRepository products; @MockBean LiveScheduler scheduler;
    RealtimePrincipal admin; List<LiveInput.Lot> lots;
    @BeforeAll static void isolated() { if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required"); }
    @BeforeEach void setup() {
        String prefix="mystery_"+UUID.randomUUID();
        db.update("INSERT INTO users(username,password_hash,role) VALUES(?,'unused','ADMIN')",prefix);
        long host=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix);
        admin=new RealtimePrincipal(host,prefix,RealtimePrincipal.Role.ADMIN);
        lots=new ArrayList<>();
        for(int i=0;i<3;i++) {
            String name=prefix+i;
            db.update("INSERT INTO products(name,quantity) VALUES(?,1)",name);
            long product=db.queryForObject("SELECT id FROM products WHERE name=?",Long.class,name);
            lots.add(new LiveInput.Lot(product,ProductVersion.of(products.findById(product).orElseThrow()),"100"));
        }
    }
    @AfterEach void cleanup() {
        for(long id:db.queryForList("SELECT id FROM livestream_sessions WHERE host_id=?",Long.class,admin.userId())) {
            var auctions=db.queryForList("SELECT auction_id FROM livestream_lots WHERE session_id=?",Long.class,id);
            db.update("DELETE c FROM livestream_mission_choices c JOIN livestream_mission_templates t ON t.id=c.template_id WHERE t.session_id=?",id);
            db.update("DELETE FROM livestream_mission_templates WHERE session_id=?",id);
            db.update("DELETE FROM livestream_commands WHERE session_id=?",id);
            db.update("DELETE FROM livestream_lots WHERE session_id=?",id);
            db.update("DELETE FROM livestream_sessions WHERE id=?",id);
            for(long auction:auctions)db.update("DELETE FROM auctions WHERE id=?",auction);
        }
        for(var lot:lots)db.update("DELETE FROM products WHERE id=?",lot.productId());
        db.update("DELETE FROM users WHERE id=?",admin.userId());
    }
    LiveInput.Create input(UUID request,String title) { return new LiveInput.Create(request,"Demo","",System.currentTimeMillis()+3600000,lots.subList(0,2),new LiveInput.Mystery(lots.get(2),List.of(new LiveInput.Mission(title,List.of(lots.get(0).productId()),List.of(lots.get(1).productId()))))); }
    @SuppressWarnings("unchecked")
    @Test void storesConfigurationRedactsAllPublicViewsAndBlocksStart() {
        var input=input(UUID.randomUUID(),"Pair");long id=service.create(admin,input);
        assertThat(service.create(admin,input)).isEqualTo(id);
        var changed=new LiveInput.Create(input.requestId(),input.title(),input.description(),input.startsAt(),input.lots(),new LiveInput.Mystery(lots.get(2),List.of(new LiveInput.Mission("Changed",List.of(lots.get(0).productId()),List.of(lots.get(1).productId())))));
        assertThatThrownBy(() -> service.create(admin,changed)).isInstanceOf(LiveException.class);
        var publicLots=(List<Map<String,Object>>)queries.session(id,false).get("lots");
        var secret=publicLots.getLast();
        assertThat(secret).containsEntry("hidden",true).doesNotContainKeys("productId","auctionId","startingPrice","currentPrice");
        assertThat(queries.session(id,true)).doesNotContainKey("missionTemplates");
        assertThat(queries.session(id,true,true)).containsKey("missionTemplates");
        assertThatThrownBy(() -> service.command(id,admin,"start",new LiveInput.Command(UUID.randomUUID(),null))).isInstanceOf(LiveException.class);
        assertThatThrownBy(() -> service.command(id,admin,"select",new LiveInput.Command(UUID.randomUUID(),Long.valueOf((String)secret.get("id"))))).isInstanceOf(LiveException.class);
        long auction=((List<Map<String,Object>>)queries.session(id,false,true).get("lots")).stream().filter(l -> "SECRET".equals(l.get("kind"))).map(l -> Long.valueOf((String)l.get("auctionId"))).findFirst().orElseThrow();
        assertThat(db.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("UPCOMING");
        assertThatThrownBy(() -> service.create(admin,input(UUID.randomUUID(),"Other"))).isInstanceOf(RuntimeException.class);
    }
}
