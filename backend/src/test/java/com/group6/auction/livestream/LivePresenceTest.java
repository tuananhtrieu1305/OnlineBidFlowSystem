package com.group6.auction.livestream;
import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class LivePresenceTest {
 LivePresence.Client client(LivePresence presence,String id) {var socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn(id);when(socket.isOpen()).thenReturn(true);return presence.register(socket,new RealtimePrincipal(1,id,RealtimePrincipal.Role.USER));}
 @Test void capsTenViewerConnectionsAndReleasesDepartedConnections(){var p=new LivePresence();for(int i=0;i<10;i++)p.join(client(p,"viewer"+i),1,false);var extra=client(p,"extra");assertThatThrownBy(()->p.join(extra,1,false)).isInstanceOf(LiveException.class);p.leave(p.client("viewer0"));p.join(extra,1,false);assertThat(p.room(1)).hasSize(10);assertThatThrownBy(()->p.join(extra,2,false)).isInstanceOf(LiveException.class);}
 @Test void exclusiveHostDoesNotConsumeViewerCapacity(){var p=new LivePresence();var host=client(p,"host");p.join(host,1,true);assertThatThrownBy(()->p.join(client(p,"otherHost"),1,true)).isInstanceOf(LiveException.class);for(int i=0;i<10;i++)p.join(client(p,"viewer"+i),1,false);assertThat(p.room(1)).hasSize(11);}
}
