package com.group6.auction.realtime.config;

import com.group6.auction.realtime.connection.MockRealtimeHandshakeInterceptor;
import com.group6.auction.realtime.connection.RealtimeWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
public class RealtimeWebSocketConfig implements WebSocketConfigurer {
    private final RealtimeWebSocketHandler realtimeWebSocketHandler;
    private final MockRealtimeHandshakeInterceptor handshakeInterceptor;
    private final String[] allowedOrigins;

    public RealtimeWebSocketConfig(RealtimeWebSocketHandler realtimeWebSocketHandler,
                                   MockRealtimeHandshakeInterceptor handshakeInterceptor,
                                   @Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
        this.realtimeWebSocketHandler = realtimeWebSocketHandler;
        this.handshakeInterceptor = handshakeInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(realtimeWebSocketHandler, "/ws/auction")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOrigins(allowedOrigins);
    }
}
