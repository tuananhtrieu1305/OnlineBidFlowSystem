package com.group6.auction.realtime.connection;

import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.socket.*;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

class SocketSessionLeaseTest {
    HttpSession http = mock(HttpSession.class);
    WebSocketSession socket = mock(WebSocketSession.class);
    SocketSessionLease lease = new SocketSessionLease(http, "session-a", "alice");
    SocketSessionLeaseTest() {
        when(http.getId()).thenReturn("session-a");
        when(http.getMaxInactiveInterval()).thenReturn(1800);
        when(http.getLastAccessedTime()).thenReturn(System.currentTimeMillis());
        when(http.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY))
            .thenReturn(new SecurityContextImpl(UsernamePasswordAuthenticationToken.authenticated("alice", null, java.util.List.of())));
        when(socket.getAttributes()).thenReturn(Map.of(SocketSessionLease.ATTRIBUTE, lease));
        when(socket.getId()).thenReturn("socket-a");
        when(socket.isOpen()).thenReturn(true);
    }
    @Test void forwardsOnlyWhileAuthenticated() throws Exception {
        var guarded = new AuthenticatedWebSocketSession(socket);
        var message = new TextMessage("private event");
        guarded.sendMessage(message);
        verify(socket).sendMessage(message);
        when(http.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY)).thenReturn(null);
        guarded.sendMessage(new TextMessage("must not leak"));
        verify(socket, times(1)).sendMessage(any());
        verify(socket).close(CloseStatus.POLICY_VIOLATION);
    }
    @Test void expiresWithoutIncomingMessagesAndBlocksOutboundBroadcast() throws Exception {
        when(http.getLastAccessedTime()).thenReturn(System.currentTimeMillis() - 1_801_000);
        assertThat(lease.valid()).isFalse();
        new AuthenticatedWebSocketSession(socket).sendMessage(new TextMessage("secret"));
        verify(socket, never()).sendMessage(any());
        var registry = new RealtimeSessionRegistry();
        registry.register(socket, new RealtimePrincipal(2, "alice", RealtimePrincipal.Role.USER));
        registry.closeExpiredSessions();
        verify(socket, times(2)).close(CloseStatus.POLICY_VIOLATION);
    }
    @Test void rejectsRotatedOrDestroyedSession() {
        when(http.getId()).thenReturn("session-b");
        assertThat(lease.valid()).isFalse();
        when(http.getId()).thenThrow(new IllegalStateException("invalidated"));
        assertThat(lease.valid()).isFalse();
    }
    @Test void closesOnlySocketsForTheAffectedHttpSession() throws Exception {
        var registry = new RealtimeSessionRegistry();
        registry.register(socket, new RealtimePrincipal(2, "alice", RealtimePrincipal.Role.USER));
        registry.closeHttpSession("other-session");
        verify(socket, never()).close(any());
        registry.closeHttpSession("session-a");
        verify(socket).close(CloseStatus.POLICY_VIOLATION);
    }
}
