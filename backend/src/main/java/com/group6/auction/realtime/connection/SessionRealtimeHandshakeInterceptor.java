package com.group6.auction.realtime.connection;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.*;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
public class SessionRealtimeHandshakeInterceptor implements HandshakeInterceptor {
    public static final String PRINCIPAL_ATTRIBUTE = "realtimePrincipal";
    private final RealtimeAuthService authService;
    public SessionRealtimeHandshakeInterceptor(RealtimeAuthService authService) { this.authService = authService; }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler handler, Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servlet)
            || !(request.getPrincipal() instanceof Authentication auth)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED); return false;
        }
        var session = servlet.getServletRequest().getSession(false);
        var principal = authService.authenticate(auth);
        if (session == null || principal.isEmpty()) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
        attributes.put(PRINCIPAL_ATTRIBUTE, principal.get());
        attributes.put(SocketSessionLease.ATTRIBUTE, new SocketSessionLease(session, session.getId(), auth.getName()));
        return true;
    }
    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler handler, Exception exception) {}
}
