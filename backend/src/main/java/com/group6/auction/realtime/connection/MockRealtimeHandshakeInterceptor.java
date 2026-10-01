package com.group6.auction.realtime.connection;

import java.util.Map;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
public class MockRealtimeHandshakeInterceptor implements HandshakeInterceptor {
    public static final String PRINCIPAL_ATTRIBUTE = "realtimePrincipal";

    private final RealtimeAuthService authService;

    public MockRealtimeHandshakeInterceptor(RealtimeAuthService authService) {
        this.authService = authService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        var principal = authService.authenticateWebSocket(request.getURI());
        principal.ifPresent(value -> attributes.put(PRINCIPAL_ATTRIBUTE, value));
        return principal.isPresent();
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }
}
