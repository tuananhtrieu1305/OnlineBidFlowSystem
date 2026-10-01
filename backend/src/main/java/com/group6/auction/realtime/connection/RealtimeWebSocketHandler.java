package com.group6.auction.realtime.connection;

import com.group6.auction.realtime.room.RoomMembershipService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {
    private static final int TEXT_MESSAGE_SIZE_LIMIT = 16 * 1024;

    private final RealtimeMessageDispatcher dispatcher;
    private final RealtimeSessionRegistry sessionRegistry;
    private final RoomMembershipService roomMembershipService;

    public RealtimeWebSocketHandler(
            RealtimeMessageDispatcher dispatcher,
            RealtimeSessionRegistry sessionRegistry,
            RoomMembershipService roomMembershipService
    ) {
        this.dispatcher = dispatcher;
        this.sessionRegistry = sessionRegistry;
        this.roomMembershipService = roomMembershipService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.setTextMessageSizeLimit(TEXT_MESSAGE_SIZE_LIMIT);
        var principal = session.getAttributes().get(SessionRealtimeHandshakeInterceptor.PRINCIPAL_ATTRIBUTE);
        if (!(principal instanceof RealtimePrincipal realtimePrincipal) || !SocketSessionLease.valid(session)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        sessionRegistry.register(new AuthenticatedWebSocketSession(session), realtimePrincipal);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        if (!SocketSessionLease.valid(session)) { session.close(CloseStatus.POLICY_VIOLATION); return; }
        var registered = sessionRegistry.sessionById(session.getId());
        if (registered.isPresent()) dispatcher.dispatch(registered.get(), message.getPayload());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        var leftRooms = roomMembershipService.disconnect(session.getId());
        dispatcher.broadcastUserLeft(session, leftRooms);
        sessionRegistry.unregister(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        var leftRooms = roomMembershipService.disconnect(session.getId());
        dispatcher.broadcastUserLeft(session, leftRooms);
        sessionRegistry.unregister(session);
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }
}
