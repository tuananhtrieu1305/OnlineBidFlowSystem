package com.group6.auction.realtime.connection;

import java.io.IOException;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.realtime.chat.ChatService;
import com.group6.auction.realtime.protocol.ChatPayload;
import com.group6.auction.realtime.protocol.ClientMessage;
import com.group6.auction.realtime.protocol.ErrorPayload;
import com.group6.auction.realtime.protocol.JoinRoomPayload;
import com.group6.auction.realtime.protocol.LeaveRoomPayload;
import com.group6.auction.realtime.protocol.ServerEvent;
import com.group6.auction.realtime.room.AuctionSnapshotService;
import com.group6.auction.realtime.room.RoomMembershipService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RealtimeMessageDispatcher {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(RealtimeMessageDispatcher.class);
    private final ObjectMapper objectMapper;
    private final RealtimeSessionRegistry sessionRegistry;
    private final RoomMembershipService roomMembershipService;
    private final AuctionSnapshotService auctionSnapshotService;
    private final ChatService chatService;

    public RealtimeMessageDispatcher(
            ObjectMapper objectMapper,
            RealtimeSessionRegistry sessionRegistry,
            RoomMembershipService roomMembershipService,
            AuctionSnapshotService auctionSnapshotService,
            ChatService chatService
    ) {
        this.objectMapper = objectMapper;
        this.sessionRegistry = sessionRegistry;
        this.roomMembershipService = roomMembershipService;
        this.auctionSnapshotService = auctionSnapshotService;
        this.chatService = chatService;
    }

    public void dispatch(WebSocketSession session, String payload) throws IOException {
        ClientMessage message;
        try {
            message = objectMapper.readValue(payload, ClientMessage.class);
        } catch (JsonProcessingException ex) {
            sendError(session, null, "INVALID_MESSAGE", "Message must be valid JSON.");
            return;
        }

        if (message.type() == null || message.type().isBlank()) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "Message type is required.");
            return;
        }

        if ("PING".equals(message.type())) {
            sendPong(session, message.requestId());
            return;
        }

        if ("JOIN_ROOM".equals(message.type())) {
            handleJoinRoom(session, message);
            return;
        }

        if ("LEAVE_ROOM".equals(message.type())) {
            handleLeaveRoom(session, message);
            return;
        }

        if ("SEND_CHAT_MESSAGE".equals(message.type())) {
            handleSendChatMessage(session, message);
            return;
        }

        sendError(session, message.requestId(), "UNKNOWN_MESSAGE_TYPE", "Unsupported message type.");
    }

    private void handleJoinRoom(WebSocketSession session, ClientMessage message) throws IOException {
        JoinRoomPayload payload;
        try {
            payload = objectMapper.treeToValue(message.payload(), JoinRoomPayload.class);
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "JOIN_ROOM payload is invalid.");
            return;
        }

        if (payload == null || payload.auctionId() == null || payload.auctionId() <= 0) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "auctionId is required.");
            return;
        }

        var principal = sessionRegistry.principalFor(session).orElseThrow();
        var sameUserAlreadyInRoom = hasSameUserSessionInAuction(payload.auctionId(), principal);
        var result = roomMembershipService.join(session.getId(), principal, payload.auctionId(), payload.roomCode());
        if (!result.allowed()) {
            sendError(session, message.requestId(), result.errorCode(), result.errorMessage());
            return;
        }

        var eventPayload = Map.of(
                "auctionId", payload.auctionId(),
                "userId", principal.userId(),
                "username", principal.username()
        );
        if (result.changed() && !sameUserAlreadyInRoom) {
            broadcast(roomMembershipService.sessionIdsForAuction(payload.auctionId()),
                    new ServerEvent("USER_JOINED", message.requestId(), payload.auctionId(), eventPayload, Instant.now().toString()));
        }
        sendAuctionState(session, message.requestId(), payload.auctionId(), principal.userId());
    }

    private void handleLeaveRoom(WebSocketSession session, ClientMessage message) throws IOException {
        LeaveRoomPayload payload;
        try {
            payload = objectMapper.treeToValue(message.payload(), LeaveRoomPayload.class);
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "LEAVE_ROOM payload is invalid.");
            return;
        }

        if (payload == null || payload.auctionId() == null || payload.auctionId() <= 0) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "auctionId is required.");
            return;
        }

        var principal = sessionRegistry.principalFor(session).orElseThrow();
        var result = roomMembershipService.leave(session.getId(), principal, payload.auctionId());
        if (!result.allowed()) {
            sendError(session, message.requestId(), result.errorCode(), result.errorMessage());
            return;
        }

        var eventPayload = Map.of(
                "auctionId", payload.auctionId(),
                "userId", principal.userId(),
                "username", principal.username()
        );
        send(session, new ServerEvent("USER_LEFT", message.requestId(), payload.auctionId(), eventPayload, Instant.now().toString()));
        if (!hasSameUserSessionInAuction(payload.auctionId(), principal)) {
            broadcast(roomMembershipService.sessionIdsForAuction(payload.auctionId()),
                    new ServerEvent("USER_LEFT", message.requestId(), payload.auctionId(), eventPayload, Instant.now().toString()));
        }
    }

    public void broadcastUserLeft(WebSocketSession departingSession, Collection<Long> auctionIds) throws IOException {
        var principal = sessionRegistry.principalFor(departingSession);
        if (principal.isEmpty()) {
            return;
        }

        for (Long auctionId : auctionIds) {
            if (hasSameUserSessionInAuction(auctionId, principal.get())) {
                continue;
            }
            var eventPayload = Map.of(
                    "auctionId", auctionId,
                    "userId", principal.get().userId(),
                    "username", principal.get().username()
            );
            broadcast(roomMembershipService.sessionIdsForAuction(auctionId),
                    new ServerEvent("USER_LEFT", null, auctionId, eventPayload, Instant.now().toString()));
        }
    }

    private void handleSendChatMessage(WebSocketSession session, ClientMessage message) throws IOException {
        ChatPayload payload;
        try {
            payload = objectMapper.treeToValue(message.payload(), ChatPayload.class);
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "SEND_CHAT_MESSAGE payload is invalid.");
            return;
        }

        if (payload == null || payload.auctionId() == null || payload.auctionId() <= 0) {
            sendError(session, message.requestId(), "INVALID_MESSAGE", "auctionId is required.");
            return;
        }

        var principal = sessionRegistry.principalFor(session).orElseThrow();
        var result = chatService.sendMessage(session.getId(), principal, payload.auctionId(), payload.content());
        if (!result.allowed()) {
            sendError(session, message.requestId(), result.errorCode(), result.errorMessage());
            return;
        }

        broadcast(roomMembershipService.sessionIdsForAuction(payload.auctionId()),
                new ServerEvent("CHAT_MESSAGE", message.requestId(), payload.auctionId(), result.message(), Instant.now().toString()));
    }

    private void sendPong(WebSocketSession session, String requestId) throws IOException {
        var principal = sessionRegistry.principalFor(session).orElseThrow();
        var payload = Map.of(
                "userId", principal.userId(),
                "username", principal.username(),
                "role", principal.role().name()
        );
        send(session, new ServerEvent("PONG", requestId, null, payload, Instant.now().toString()));
    }

    private void sendAuctionState(WebSocketSession session, String requestId, long auctionId, long userId) throws IOException {
        var snapshot = auctionSnapshotService.buildSnapshot(auctionId, userId);
        if (snapshot.isPresent()) {
            send(session, new ServerEvent("AUCTION_STATE", requestId, auctionId, snapshot.get(), Instant.now().toString()));
        }
    }

    private void sendError(WebSocketSession session, String requestId, String code, String message) throws IOException {
        send(session, new ServerEvent("ERROR", requestId, null, ErrorPayload.of(code, message), Instant.now().toString()));
    }

    private void send(WebSocketSession session, ServerEvent event) throws IOException {
        if (session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(event)));
            } catch (IllegalStateException ex) {
                if (session.isOpen()) {
                    throw ex;
                }
            }
        }
    }

    private void broadcast(Collection<String> sessionIds, ServerEvent event) {
        for (String sessionId : sessionIds) {
            var session = sessionRegistry.sessionById(sessionId);
            if (session.isPresent()) {
                try {
                    send(session.get(), event);
                } catch (IOException | RuntimeException ex) {
                    // Delivery to one stale/slow socket must not interrupt other recipients
                    // or the joining client's snapshot. Transport callbacks own cleanup.
                    log.warn("Realtime {} delivery failed for session {}", event.type(), sessionId, ex);
                }
            }
        }
    }

    private boolean hasSameUserSessionInAuction(long auctionId, RealtimePrincipal principal) {
        for (String sessionId : roomMembershipService.sessionIdsForAuction(auctionId)) {
            var remainingPrincipal = sessionRegistry.principalForSessionId(sessionId);
            if (remainingPrincipal.isPresent() && remainingPrincipal.get().userId() == principal.userId()) {
                return true;
            }
        }
        return false;
    }
}
