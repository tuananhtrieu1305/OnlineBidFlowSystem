package com.group6.auction.realtime.connection;

import java.io.IOException;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

/** Serializes concurrent broadcasts and checks authorization before every outbound message. */
public class AuthenticatedWebSocketSession extends ConcurrentWebSocketSessionDecorator {
    public AuthenticatedWebSocketSession(WebSocketSession delegate) { super(delegate, 10_000, 256 * 1024); }
    @Override public void sendMessage(WebSocketMessage<?> message) throws IOException {
        if (!SocketSessionLease.valid(this)) { close(CloseStatus.POLICY_VIOLATION); return; }
        super.sendMessage(message);
    }
}
