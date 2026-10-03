package com.group6.auction.realtime.connection;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.realtime.chat.ChatService;
import com.group6.auction.realtime.room.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.*;
import java.io.IOException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class RealtimeDeliveryFailureTest {
 @Test void failedRecipientDoesNotPreventOtherPresenceOrJoiningSnapshot() throws Exception {
  var registry=new RealtimeSessionRegistry();var rooms=mock(RoomMembershipService.class);
  var snapshots=mock(AuctionSnapshotService.class);
  var dispatcher=new RealtimeMessageDispatcher(new ObjectMapper(),registry,rooms,snapshots,mock(ChatService.class));
  var joining=socket("joining");var broken=socket("broken");var healthy=socket("healthy");
  registry.register(joining,new RealtimePrincipal(2,"alice",RealtimePrincipal.Role.USER));
  registry.register(broken,new RealtimePrincipal(3,"bob",RealtimePrincipal.Role.USER));
  registry.register(healthy,new RealtimePrincipal(4,"carol",RealtimePrincipal.Role.USER));
  when(rooms.sessionIdsForAuction(1)).thenReturn(new LinkedHashSet<>(List.of("broken","healthy")));
  when(rooms.join(eq("joining"),any(),eq(1L),isNull())).thenReturn(RoomAccessResult.success());
  when(snapshots.buildSnapshot(1,2)).thenReturn(Optional.of(Map.of("auctionId",1)));
  doThrow(new IOException("offline")).when(broken).sendMessage(any());
  assertThatCode(()->dispatcher.dispatch(joining,"{\"type\":\"JOIN_ROOM\",\"payload\":{\"auctionId\":1}}" )).doesNotThrowAnyException();
  verify(healthy).sendMessage(argThat(m->m.getPayload().toString().contains("USER_JOINED")));
  verify(snapshots).buildSnapshot(1,2);
  verify(joining).sendMessage(argThat(m->m.getPayload().toString().contains("AUCTION_STATE")));
 }
 @Test void disconnectAlwaysUnregistersEvenIfPresenceFails() throws Exception {
  for(boolean transport:List.of(false,true)){
   var dispatcher=mock(RealtimeMessageDispatcher.class);var registry=new RealtimeSessionRegistry();var rooms=mock(RoomMembershipService.class);
   var socket=socket("departing");registry.register(socket,new RealtimePrincipal(2,"alice",RealtimePrincipal.Role.USER));
   when(rooms.disconnect("departing")).thenReturn(Set.of(1L));
   doThrow(new IOException("delivery failed")).when(dispatcher).broadcastUserLeft(eq(socket),any());
   var handler=new RealtimeWebSocketHandler(dispatcher,registry,rooms);
   assertThatThrownBy(()->{if(transport)handler.handleTransportError(socket,new IOException());else handler.afterConnectionClosed(socket,CloseStatus.NORMAL);}).isInstanceOf(IOException.class);
   assertThat(registry.size()).isZero();
   if(transport)verify(socket).close(CloseStatus.SERVER_ERROR);
  }
 }
 private WebSocketSession socket(String id){var s=mock(WebSocketSession.class);when(s.getId()).thenReturn(id);when(s.isOpen()).thenReturn(true);return s;}
}
