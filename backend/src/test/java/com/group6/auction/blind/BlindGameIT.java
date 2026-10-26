package com.group6.auction.blind;

import com.group6.auction.auction.blind.BlindException;
import com.group6.auction.auction.blind.BlindService;
import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.realtime.connection.RealtimeSessionRegistry;
import com.group6.auction.realtime.room.RoomMembershipService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.WebSocketSession;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.auctions.auto-start=false")
@AutoConfigureMockMvc
@Transactional(isolation=Isolation.READ_COMMITTED)
class BlindGameIT {
    @Autowired JdbcTemplate jdbc;
    @Autowired BlindService blind;
    @Autowired RoomMembershipService membership;
    @Autowired RealtimeSessionRegistry sessions;
    @Autowired MockMvc mvc;
    @MockBean Clock clock;
    @BeforeAll static void guard(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated MySQL required");}

    private record Fixture(long auction,long[] users,String[] names,LocalDateTime start) {}
    private void time(LocalDateTime value){when(clock.instant()).thenReturn(value.toInstant(ZoneOffset.UTC));}
    private MockHttpSession userSession(String name){
        var session=new MockHttpSession();session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
            new SecurityContextImpl(new UsernamePasswordAuthenticationToken(name,null,List.of(new SimpleGrantedAuthority("ROLE_USER")))));
        return session;
    }
    private Fixture fixture(){
        String prefix="blind_"+UUID.randomUUID().toString().substring(0,8);
        long[] users=new long[4];String[] names=new String[4];
        for(int i=0;i<4;i++){
            names[i]=prefix+i;
            jdbc.update("INSERT INTO users(username,password_hash,role) VALUES (?,'unused','USER')",names[i]);
            users[i]=jdbc.queryForObject("SELECT id FROM users WHERE username=?",Long.class,names[i]);
            jdbc.update("INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) VALUES (?,'USER',3000,0,?)",users[i],LocalDateTime.of(2030,1,1,0,0));
            long wallet=jdbc.queryForObject("SELECT id FROM wallets WHERE user_id=?",Long.class,users[i]);
            jdbc.update("INSERT INTO coin_transactions(wallet_id,transaction_type,available_delta,locked_delta,created_at) VALUES (?,'DEPOSIT',3000,0,?)",wallet,LocalDateTime.of(2030,1,1,0,0));
        }
        jdbc.update("INSERT INTO products(name,quantity) VALUES (?,1)",prefix);
        long product=jdbc.queryForObject("SELECT id FROM products WHERE name=?",Long.class,prefix);
        LocalDateTime start=LocalDateTime.of(2031,1,1,0,0);
        jdbc.update("INSERT INTO auctions(product_id,created_by,auction_type,access_type,status,starting_price,max_participants,start_time,end_time) VALUES (?,1,'BLIND','PUBLIC','RUNNING',500,4,?,?)",product,start,start.plusSeconds(500));
        long auction=jdbc.queryForObject("SELECT id FROM auctions WHERE product_id=?",Long.class,product);
        jdbc.update("INSERT INTO blind_rounds(auction_id,started_at,trade_ends_at,bid_locks_at,ends_at) VALUES (?,?,?,?,?)",auction,start,start.plusSeconds(320),start.plusSeconds(480),start.plusSeconds(500));
        List<Long> clues=new ArrayList<>();
        for(int i=0;i<4;i++){
            jdbc.update("INSERT INTO auction_participants(auction_id,user_id,joined_at) VALUES (?,?,?)",auction,users[i],start);
            jdbc.update("INSERT INTO blind_clues(auction_id,slot,content) VALUES (?,?,?)",auction,i+1,"True fact "+i);
            long clue=jdbc.queryForObject("SELECT id FROM blind_clues WHERE auction_id=? AND slot=?",Long.class,auction,i+1);clues.add(clue);
            jdbc.update("INSERT INTO blind_clue_ownership(auction_id,clue_id,user_id,acquired_at) VALUES (?,?,?,?)",auction,clue,users[i],start);
        }
        return new Fixture(auction,users,names,start);
    }

    @Test void tradesAreAtomicPrivateAndResellableAndOnlyLatestBidsCompete(){
        var f=fixture();long auction=f.auction(),clue=jdbc.queryForObject("SELECT id FROM blind_clues WHERE auction_id=? AND slot=1",Long.class,auction);
        time(f.start().plusSeconds(21));
        blind.list(auction,clue,f.names()[0],"50");
        long listing=jdbc.queryForObject("SELECT id FROM blind_clue_listings WHERE clue_id=? AND seller_id=?",Long.class,clue,f.users()[0]);
        blind.list(auction,clue,f.names()[0],"60");
        assertThatThrownBy(()->blind.buy(auction,listing,f.names()[1],"1")).isInstanceOf(BlindException.class).hasMessage("LISTING_CHANGED");
        blind.list(auction,clue,f.names()[0],"50");
        blind.buy(auction,listing,f.names()[1],"3");
        assertThatThrownBy(()->blind.buy(auction,listing,f.names()[1],"3")).isInstanceOf(BlindException.class).hasMessage("CLUE_ALREADY_KNOWN");
        blind.list(auction,clue,f.names()[1],"60");
        long resale=jdbc.queryForObject("SELECT id FROM blind_clue_listings WHERE clue_id=? AND seller_id=?",Long.class,clue,f.users()[1]);
        blind.buy(auction,resale,f.names()[2],"1");
        var outsider=blind.state(auction,f.names()[3]).toString();
        assertThat(outsider).doesNotContain("True fact 0");
        assertThat(blind.state(auction,f.names()[1]).toString()).contains("True fact 0");
        assertThat(blind.state(auction,f.names()[2]).toString()).contains("True fact 0");
        long buyerWallet=jdbc.queryForObject("SELECT id FROM wallets WHERE user_id=?",Long.class,f.users()[1]);
        assertThat(jdbc.queryForObject("SELECT available_balance FROM wallets WHERE id=?",Long.class,buyerWallet)).isEqualTo(3010);
        time(f.start().plusSeconds(320));
        assertThat(blind.state(auction,f.names()[0]).toString()).contains("DISCUSS");
        assertThatThrownBy(()->blind.buy(auction,listing,f.names()[3],"3")).isInstanceOf(BlindException.class).hasMessage("CLUE_MARKET_CLOSED");
        assertThatThrownBy(()->blind.bid(auction,f.names()[0],"500")).isInstanceOf(BlindException.class).hasMessage("BID_WINDOW_CLOSED");
        time(f.start().plusSeconds(380));blind.bid(auction,f.names()[0],"500");
        time(f.start().plusSeconds(381));blind.bid(auction,f.names()[1],"500");
        time(f.start().plusSeconds(382));blind.bid(auction,f.names()[0],"500");
        time(f.start().plusSeconds(480));
        assertThatThrownBy(()->blind.bid(auction,f.names()[2],"600")).isInstanceOf(BlindException.class).hasMessage("BID_WINDOW_CLOSED");
        time(f.start().plusSeconds(500));blind.finishIfDue(auction);
        assertThat(jdbc.queryForObject("SELECT winner_user_id FROM auctions WHERE id=?",Long.class,auction)).isEqualTo(f.users()[1]);
        assertThat(jdbc.queryForObject("SELECT available_balance FROM wallets WHERE id=?",Long.class,buyerWallet)).isEqualTo(2510);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='CLUE_TRADE'",Long.class,auction)).isEqualTo(4);
    }

    @Test void belowFloorFinishesUnsoldAndReleasesBid(){
        var f=fixture();time(f.start().plusSeconds(380));blind.bid(f.auction(),f.names()[0],"499");
        time(f.start().plusSeconds(500));blind.finishIfDue(f.auction());
        assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,f.auction())).isEqualTo("UNSOLD");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM coin_transactions WHERE auction_id=? AND transaction_type='PAYMENT'",Long.class,f.auction())).isZero();
        long wallet=jdbc.queryForObject("SELECT id FROM wallets WHERE user_id=?",Long.class,f.users()[0]);
        assertThat(jdbc.queryForObject("SELECT available_balance FROM wallets WHERE id=?",Long.class,wallet)).isEqualTo(3000);
        assertThat(jdbc.queryForObject("SELECT locked_balance FROM wallets WHERE id=?",Long.class,wallet)).isZero();
    }

    @Test void httpStateExposesOnlyOwnClueAndBidWindowIsEnforced()throws Exception{
        var f=fixture();time(f.start().plusSeconds(21));var session=userSession(f.names()[0]);
        mvc.perform(get("/api/blind/auctions/"+f.auction())).andExpect(status().isUnauthorized());
        String body=mvc.perform(get("/api/blind/auctions/"+f.auction()).session(session)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("True fact 0").doesNotContain("True fact 1","startingPrice","highestBid");
        mvc.perform(get("/api/admin/blind/auctions/"+f.auction()+"/clues").session(session)).andExpect(status().isForbidden());
        mvc.perform(post("/api/blind/auctions/"+f.auction()+"/bids").session(session).contentType("application/json").content("{\"amount\":\"600\"}"))
            .andExpect(status().isForbidden()); // CSRF
        var csrf=mvc.perform(get("/api/auth/csrf").session(session)).andReturn().getResponse().getContentAsString();
        String token=new com.fasterxml.jackson.databind.ObjectMapper().readTree(csrf).get("token").asText();
        mvc.perform(post("/api/blind/auctions/"+f.auction()+"/bids").session(session).header("X-CSRF-TOKEN",token)
            .contentType("application/json").content("{\"amount\":\"600\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BID_WINDOW_CLOSED"));
    }

    @Test void startsOnlyWhenFourDistinctPlayersAreOnlineAndDoesNotReplaceDisconnectedPlayer(){
        var f=fixture();long auction=f.auction();
        jdbc.update("DELETE FROM blind_clue_ownership WHERE auction_id=?",auction);
        jdbc.update("DELETE FROM blind_rounds WHERE auction_id=?",auction);
        jdbc.update("UPDATE auctions SET status='UPCOMING',start_time=?,end_time=? WHERE id=?",f.start(),f.start().plusHours(1),auction);
        time(f.start());var sockets=new ArrayList<WebSocketSession>();
        try{
            for(int i=0;i<4;i++){
                var socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn("blind-game-test-"+UUID.randomUUID());
                var principal=new RealtimePrincipal(f.users()[i],f.names()[i],RealtimePrincipal.Role.USER);
                sessions.register(socket,principal);sockets.add(socket);
                assertThat(membership.join(socket.getId(),principal,auction,null).allowed()).isTrue();
                if(i==2){blind.startIfReady(auction);assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("UPCOMING");}
            }
            blind.startIfReady(auction);
            assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("RUNNING");
            assertThat(jdbc.queryForObject("SELECT COUNT(DISTINCT clue_id) FROM blind_clue_ownership WHERE auction_id=?",Long.class,auction)).isEqualTo(4);
            long first=jdbc.queryForObject("SELECT clue_id FROM blind_clue_ownership WHERE auction_id=? AND user_id=?",Long.class,auction,f.users()[0]);
            membership.disconnect(sockets.getFirst().getId());sessions.unregister(sockets.getFirst());
            assertThat(jdbc.queryForObject("SELECT status FROM auctions WHERE id=?",String.class,auction)).isEqualTo("RUNNING");
            assertThat(jdbc.queryForObject("SELECT clue_id FROM blind_clue_ownership WHERE auction_id=? AND user_id=?",Long.class,auction,f.users()[0])).isEqualTo(first);
        }finally{for(var socket:sockets){membership.disconnect(socket.getId());sessions.unregister(socket);}}
    }
}
