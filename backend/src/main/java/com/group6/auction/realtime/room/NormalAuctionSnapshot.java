package com.group6.auction.realtime.room;

import java.util.List;

import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;
import com.group6.auction.realtime.chat.ChatMessageSnapshot;

public record NormalAuctionSnapshot(
        long auctionId,
        AuctionType auctionType,
        AuctionStatus status,
        AuctionAccessType accessType,
        ProductSnapshot product,
        Long startingPrice,
        Long currentPrice,
        List<PublicBidSnapshot> bidHistory,
        CurrentLeaderSnapshot currentLeader,
        long remainingSeconds,
        List<ChatMessageSnapshot> chatHistory
) {
}
