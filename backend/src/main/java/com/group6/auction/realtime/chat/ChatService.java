package com.group6.auction.realtime.chat;

import java.time.Clock;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.realtime.room.RoomDataGateway;
import com.group6.auction.realtime.room.RoomMembershipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ChatService {
    private static final int MAX_CONTENT_LENGTH = 500;

    private final RoomMembershipService roomMembershipService;
    private final RoomDataGateway roomDataGateway;
    private final ChatMessageStore messageStore;
    private final ChatAntiSpamService antiSpamService;
    private final Clock clock;

    @Autowired
    public ChatService(
            RoomMembershipService roomMembershipService,
            RoomDataGateway roomDataGateway,
            ChatMessageStore messageStore,
            ChatAntiSpamService antiSpamService
    ) {
        this(roomMembershipService, roomDataGateway, messageStore, antiSpamService, Clock.systemUTC());
    }

    public ChatService(
            RoomMembershipService roomMembershipService,
            RoomDataGateway roomDataGateway,
            ChatMessageStore messageStore,
            ChatAntiSpamService antiSpamService,
            Clock clock
    ) {
        this.roomMembershipService = roomMembershipService;
        this.roomDataGateway = roomDataGateway;
        this.messageStore = messageStore;
        this.antiSpamService = antiSpamService;
        this.clock = clock;
    }

    public ChatSendResult sendMessage(String sessionId, RealtimePrincipal principal, long auctionId, String content) {
        if (auctionId <= 0) {
            return ChatSendResult.denied("INVALID_MESSAGE", "auctionId is required.");
        }
        if (!roomMembershipService.auctionIdsForSession(sessionId).contains(auctionId)) {
            return ChatSendResult.denied("NOT_IN_ROOM", "Join the auction room before sending chat.");
        }
        if (roomDataGateway.findAuction(auctionId).isEmpty()) {
            return ChatSendResult.denied("AUCTION_NOT_FOUND", "Auction room was not found.");
        }

        var normalizedContent = normalize(content);
        if (normalizedContent.isBlank()) {
            return ChatSendResult.denied("CHAT_EMPTY", "Chat message cannot be empty.");
        }
        if (normalizedContent.length() > MAX_CONTENT_LENGTH) {
            return ChatSendResult.denied("CHAT_TOO_LONG", "Chat message must be 500 characters or fewer.");
        }
        if (!antiSpamService.tryAcquire(auctionId, principal.userId())) {
            return ChatSendResult.denied("CHAT_RATE_LIMITED", "Please wait before sending another chat message.");
        }

        var message = messageStore.save(
                auctionId,
                principal.userId(),
                principal.username(),
                normalizedContent,
                clock.instant()
        );
        return ChatSendResult.success(message);
    }

    private String normalize(String content) {
        return content == null ? "" : content.trim();
    }
}
