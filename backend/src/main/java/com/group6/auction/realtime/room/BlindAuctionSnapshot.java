package com.group6.auction.realtime.room;

import java.util.List;

import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;
import com.group6.auction.realtime.chat.ChatMessageSnapshot;

public record BlindAuctionSnapshot(
        long auctionId,
        AuctionType auctionType,
        AuctionStatus status,
        AuctionAccessType accessType,
        ProductSnapshot product,
        OwnBidSnapshot ownBid,
        AuctionHistoricalStats historicalStats,
        long remainingSeconds,
        List<ChatMessageSnapshot> chatHistory
) {
}
