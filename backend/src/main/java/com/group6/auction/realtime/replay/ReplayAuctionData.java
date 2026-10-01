package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;

import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;
import com.group6.auction.realtime.room.ProductSnapshot;

public record ReplayAuctionData(
        long auctionId,
        long productId,
        AuctionType auctionType,
        AuctionStatus status,
        AuctionAccessType accessType,
        ProductSnapshot product,
        long startingPrice,
        LocalDateTime startTime,
        LocalDateTime endTime,
        LocalDateTime finishedAt,
        Long winnerUserId,
        Long winningPrice
) {
}
