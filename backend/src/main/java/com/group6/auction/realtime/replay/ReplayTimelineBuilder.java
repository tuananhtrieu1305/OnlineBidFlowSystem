package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.group6.auction.auction.entity.AuctionType;
import org.springframework.stereotype.Component;

@Component
public class ReplayTimelineBuilder {
    public List<ReplayTimelineEvent> build(
            ReplayAuctionData auction,
            ReplayViewer viewer,
            List<ReplayBidData> bids,
            List<ReplayChatData> chatMessages
    ) {
        var events = new ArrayList<TimedReplayEvent>();
        events.add(new TimedReplayEvent(auction.startTime(), 0, "AUCTION_STARTED", auctionStartedPayload(auction)));

        visibleBids(auction, viewer, bids).forEach(bid ->
                events.add(new TimedReplayEvent(bid.createdAt(), 1, "BID_PLACED", bidPayload(bid, viewer))));

        chatMessages.forEach(message ->
                events.add(new TimedReplayEvent(message.sentAt(), 2, "CHAT_MESSAGE", chatPayload(message))));

        events.add(new TimedReplayEvent(finishedAt(auction), 3, "AUCTION_FINISHED", finishedPayload(auction)));

        return events.stream()
                .sorted(Comparator.comparing(TimedReplayEvent::at).thenComparingInt(TimedReplayEvent::order))
                .map(event -> new ReplayTimelineEvent(event.type(), iso(event.at()), event.payload()))
                .toList();
    }

    private List<ReplayBidData> visibleBids(ReplayAuctionData auction, ReplayViewer viewer, List<ReplayBidData> bids) {
        if (auction.auctionType() == AuctionType.NORMAL || viewer.admin()) {
            return bids;
        }
        return bids.stream()
                .filter(bid -> bid.userId() == viewer.userId())
                .toList();
    }

    private Map<String, Object> auctionStartedPayload(ReplayAuctionData auction) {
        var payload = orderedMap();
        payload.put("auctionId", auction.auctionId());
        payload.put("auctionType", auction.auctionType().name());
        payload.put("status", auction.status().name());
        payload.put("product", auction.product());
        if (auction.auctionType() == AuctionType.NORMAL) {
            payload.put("startingPrice", auction.startingPrice());
        }
        return payload;
    }

    private Map<String, Object> bidPayload(ReplayBidData bid, ReplayViewer viewer) {
        var payload = orderedMap();
        payload.put("bidId", bid.bidId());
        payload.put("auctionId", bid.auctionId());
        payload.put("userId", bid.userId());
        payload.put("amount", bid.amount());
        payload.put("createdAt", iso(bid.createdAt()));
        payload.put("ownBid", bid.userId() == viewer.userId());
        return payload;
    }

    private Map<String, Object> chatPayload(ReplayChatData message) {
        var payload = orderedMap();
        payload.put("messageId", message.messageId());
        payload.put("auctionId", message.auctionId());
        payload.put("userId", message.userId());
        payload.put("username", message.username());
        payload.put("content", message.content());
        payload.put("sentAt", iso(message.sentAt()));
        return payload;
    }

    private Map<String, Object> finishedPayload(ReplayAuctionData auction) {
        var payload = orderedMap();
        payload.put("auctionId", auction.auctionId());
        payload.put("status", auction.status().name());
        payload.put("winnerUserId", auction.winnerUserId());
        payload.put("winningPrice", auction.winningPrice());
        payload.put("finishedAt", iso(finishedAt(auction)));
        return payload;
    }

    private LocalDateTime finishedAt(ReplayAuctionData auction) {
        return auction.finishedAt() == null ? auction.endTime() : auction.finishedAt();
    }

    private String iso(LocalDateTime time) {
        return time.atOffset(ZoneOffset.UTC).toInstant().toString();
    }

    private Map<String, Object> orderedMap() {
        return new LinkedHashMap<>();
    }

    private record TimedReplayEvent(LocalDateTime at, int order, String type, Object payload) {
    }
}
