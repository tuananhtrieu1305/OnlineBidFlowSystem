package com.group6.auction.realtime.connection;

import java.io.IOException;
import java.time.Instant;
import java.util.Collection;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.realtime.chat.ChatMessageSnapshot;
import com.group6.auction.realtime.protocol.AuctionFinishedPayload;
import com.group6.auction.realtime.protocol.BlindBidAcceptedPayload;
import com.group6.auction.realtime.protocol.NormalPriceUpdatedPayload;
import com.group6.auction.realtime.protocol.ServerEvent;
import com.group6.auction.realtime.protocol.UserPresencePayload;
import com.group6.auction.realtime.room.RoomMembershipService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RealtimeEventPublisher {
    private final ObjectMapper objectMapper;
    private final RealtimeSessionRegistry sessionRegistry;
    private final RoomMembershipService roomMembershipService;

    public RealtimeEventPublisher(
            ObjectMapper objectMapper,
            RealtimeSessionRegistry sessionRegistry,
            RoomMembershipService roomMembershipService
    ) {
        this.objectMapper = objectMapper;
        this.sessionRegistry = sessionRegistry;
        this.roomMembershipService = roomMembershipService;
    }

    public void sendToSession(String sessionId, ServerEvent event) throws IOException {
        var session = sessionRegistry.sessionById(sessionId);
        if (session.isPresent()) {
            send(session.get(), event);
        }
    }

    public void sendToUser(long userId, ServerEvent event) throws IOException {
        sendToSessions(sessionRegistry.sessionIdsForUser(userId), event);
    }

    public void sendToUser(long userId, String type, Long auctionId, Object payload) throws IOException {
        sendToUser(userId, event(type, null, auctionId, payload));
    }

    public void broadcastToAuctionRoom(long auctionId, ServerEvent event) throws IOException {
        sendToSessions(roomMembershipService.sessionIdsForAuction(auctionId), event);
    }

    public void broadcastToAuctionRoom(long auctionId, String type, Object payload) throws IOException {
        broadcastToAuctionRoom(auctionId, event(type, null, auctionId, payload));
    }

    public void broadcastUserJoined(long auctionId, RealtimePrincipal principal) throws IOException {
        broadcastToAuctionRoom(auctionId, "USER_JOINED",
                new UserPresencePayload(auctionId, principal.userId(), principal.username()));
    }

    public void broadcastUserLeft(long auctionId, RealtimePrincipal principal) throws IOException {
        broadcastToAuctionRoom(auctionId, "USER_LEFT",
                new UserPresencePayload(auctionId, principal.userId(), principal.username()));
    }

    public void broadcastChatMessage(long auctionId, ChatMessageSnapshot message) throws IOException {
        broadcastToAuctionRoom(auctionId, "CHAT_MESSAGE", message);
    }

    public void broadcastNormalPriceUpdated(long auctionId, NormalPriceUpdatedPayload payload) throws IOException {
        broadcastToAuctionRoom(auctionId, event("NORMAL_PRICE_UPDATED", null, auctionId, payload));
    }

    public void sendBlindBidAccepted(long userId, long auctionId, BlindBidAcceptedPayload payload) throws IOException {
        sendToUser(userId, event("BLIND_BID_ACCEPTED", null, auctionId, payload));
    }

    public void broadcastAuctionFinished(long auctionId, AuctionFinishedPayload payload) throws IOException {
        broadcastToAuctionRoom(auctionId, event("AUCTION_FINISHED", null, auctionId, payload));
    }

    private ServerEvent event(String type, String requestId, Long auctionId, Object payload) {
        return new ServerEvent(type, requestId, auctionId, payload, Instant.now().toString());
    }

    private void sendToSessions(Collection<String> sessionIds, ServerEvent event) throws IOException {
        IOException failure = null;
        for (String sessionId : sessionIds) {
            try {
                sendToSession(sessionId, event);
            } catch (IOException | RuntimeException ex) {
                // A closed/slow recipient must not starve the other recipients.
                if (failure == null) failure = new IOException("Realtime delivery failed", ex);
            }
        }
        if (failure != null) throw failure;
    }

    private void send(WebSocketSession session, ServerEvent event) throws IOException {
        if (!session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(event)));
        } catch (IllegalStateException ex) {
            if (session.isOpen()) {
                throw ex;
            }
        }
    }
}
