package com.group6.auction.health;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** Connectivity probe only. Auction events and authorization belong in their own handlers. */
public class HealthWebSocketHandler extends TextWebSocketHandler {
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        session.setTextMessageSizeLimit(128);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        if (!"PING".equals(message.getPayload())) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        session.sendMessage(new TextMessage("PONG"));
    }
}
