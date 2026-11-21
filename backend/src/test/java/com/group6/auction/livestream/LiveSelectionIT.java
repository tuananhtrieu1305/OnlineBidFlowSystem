package com.group6.auction.livestream;

import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.product.service.ProductVersion;
import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.wallet.service.WalletQueryService;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.socket.WebSocketSession;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional(isolation=Isolation.READ_COMMITTED)
class LiveSelectionIT {
    @Autowired LiveService service;
    @Autowired LivePresence presence;
    @Autowired JdbcTemplate db;
    @Autowired ProductRepository products;
    @Autowired WalletQueryService wallets;
    @MockBean Clock clock;
    @MockBean LiveScheduler scheduler;
    long now=System.currentTimeMillis(),id,buyerId;
    List<Long> lots;
    RealtimePrincipal admin,buyer;
    LivePresence.Client publisher;
    String prefix="select_"+UUID.randomUUID().toString().substring(0,8);

    @BeforeAll static void isolated() {
        if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");
    }
    @BeforeEach void setup() throws Exception {
        when(clock.millis()).thenAnswer(i->now);
        when(clock.instant()).thenAnswer(i->Instant.ofEpochMilli(now));
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        db.update("INSERT INTO users(username,password_hash,role) VALUES(?,'test-only','ADMIN'),(?,'test-only','USER')",prefix+"host",prefix+"buyer");
        long host=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+"host");
        buyerId=db.queryForObject("SELECT id FROM users WHERE username=?",Long.class,prefix+"buyer");
        admin=new RealtimePrincipal(host,prefix+"host",RealtimePrincipal.Role.ADMIN);
        buyer=new RealtimePrincipal(buyerId,prefix+"buyer",RealtimePrincipal.Role.USER);
        db.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES(?,'USER',0,0,UTC_TIMESTAMP(6))",buyerId);
        wallets.deposit(prefix+"buyer",1000);
        var items=new ArrayList<LiveInput.Lot>();
        for(int index=0;index<3;index++) {
            String name=prefix+index;
            db.update("INSERT INTO products(name,quantity) VALUES(?,1)",name);
            long product=db.queryForObject("SELECT id FROM products WHERE name=?",Long.class,name);
            items.add(new LiveInput.Lot(product,ProductVersion.of(products.findById(product).orElseThrow()),"100"));
        }
        id=service.create(admin,new LiveInput.Create(UUID.randomUUID(),prefix,"",now+60000,items));
        lots=db.queryForList("SELECT id FROM livestream_lots WHERE session_id=? ORDER BY position",Long.class,id);
        var socket=mock(WebSocketSession.class);
        when(socket.getId()).thenReturn(UUID.randomUUID().toString());
        when(socket.isOpen()).thenReturn(true);
        publisher=presence.register(socket,admin);
        service.join(id,publisher);
    }
    @AfterEach void removePresence() { for(var client:presence.all())presence.remove(client.socket.getId()); }
    void select(int index) { service.command(id,admin,"select",new LiveInput.Command(UUID.randomUUID(),lots.get(index))); }
    void start() { service.ready(id,publisher,true);service.command(id,admin,"start",new LiveInput.Command(UUID.randomUUID(),lots.get(current()))); }
    int current() { return db.queryForObject("SELECT current_lot_index FROM livestream_sessions WHERE id=?",Integer.class,id); }
    String phase(int index) { return db.queryForObject("SELECT phase FROM livestream_lots WHERE id=?",String.class,lots.get(index)); }

    @Test void choosesAnyFirstItemBeforeStarting() {
        select(2);
        assertThat(current()).isEqualTo(2);
        assertThat(phase(0)).isEqualTo("QUEUED");
        start();
        assertThat(phase(2)).isEqualTo("PRESENTING");
    }
    @Test void canGoBackToSkippedItemsAndReintroduceAnUnsoldItem() {
        start();select(2);
        assertThat(phase(0)).isEqualTo("QUEUED");
        select(0);
        assertThat(current()).isZero();
        assertThat(phase(2)).isEqualTo("QUEUED");
        service.command(id,admin,"open",new LiveInput.Command(UUID.randomUUID(),lots.get(0)));
        select(1);
        assertThat(phase(0)).isEqualTo("UNSOLD");
        select(0);
        assertThat(phase(0)).isEqualTo("PRESENTING");
        assertThat(db.queryForObject("SELECT status FROM auctions WHERE id=(SELECT auction_id FROM livestream_lots WHERE id=?)",String.class,lots.get(0))).isEqualTo("UPCOMING");
        assertThat(db.queryForObject("SELECT end_time FROM auctions WHERE id=(SELECT auction_id FROM livestream_lots WHERE id=?)",LocalDateTime.class,lots.get(0))).isNull();
    }
    @Test void activeBidCannotBeSwitchedAndSoldItemsCannotBeSelectedAgain() {
        start();service.command(id,admin,"open",new LiveInput.Command(UUID.randomUUID(),lots.get(0)));
        var socket=mock(WebSocketSession.class);
        when(socket.getId()).thenReturn(UUID.randomUUID().toString());when(socket.isOpen()).thenReturn(true);
        service.join(id,presence.register(socket,buyer));
        service.bid(id,lots.get(0),buyer,new LiveInput.Bid(UUID.randomUUID(),"100"));
        assertThatThrownBy(()->select(2)).isInstanceOf(LiveException.class);
        assertThat(current()).isZero();
        assertThat(db.queryForObject("SELECT locked_balance FROM wallets WHERE user_id=?",Long.class,buyerId)).isEqualTo(100);
        now+=5000;service.heartbeat(id,publisher);service.tick(id,false);
        select(2);
        assertThatThrownBy(()->select(0)).isInstanceOf(LiveException.class);
        assertThat(current()).isEqualTo(2);
        assertThat(phase(0)).isEqualTo("SOLD");
    }
    @Test void restrictsCommandsToHostSessionAndRunningStates() {
        assertThatThrownBy(()->service.command(id,buyer,"select",new LiveInput.Command(UUID.randomUUID(),lots.get(2)))).isInstanceOf(LiveException.class);
        assertThatThrownBy(()->service.command(id,admin,"select",new LiveInput.Command(UUID.randomUUID(),Long.MAX_VALUE))).isInstanceOf(LiveException.class);
        assertThatThrownBy(()->service.command(id,admin,"select",new LiveInput.Command(UUID.randomUUID(),null))).isInstanceOf(LiveException.class);
        start();service.ready(id,publisher,false);
        assertThatThrownBy(()->select(2)).isInstanceOf(LiveException.class);
        service.command(id,admin,"end",new LiveInput.Command(UUID.randomUUID(),lots.get(0)));
        assertThatThrownBy(()->select(2)).isInstanceOf(LiveException.class);
        assertThat(current()).isZero();
    }
    @Test void retriesDoNotUndoLaterSelectionsAndCannotChangeTheirTarget() {
        var request=new LiveInput.Command(UUID.randomUUID(),lots.get(2));
        service.command(id,admin,"select",request);select(1);
        long revision=db.queryForObject("SELECT revision FROM livestream_sessions WHERE id=?",Long.class,id);
        service.command(id,admin,"select",request);
        assertThat(current()).isEqualTo(1);
        assertThat(db.queryForObject("SELECT revision FROM livestream_sessions WHERE id=?",Long.class,id)).isEqualTo(revision);
        assertThatThrownBy(()->service.command(id,admin,"select",new LiveInput.Command(request.requestId(),lots.get(1)))).isInstanceOf(LiveException.class);
    }
}
