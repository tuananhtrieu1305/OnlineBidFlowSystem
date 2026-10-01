package com.group6.auction.realtime.room;

import java.time.LocalDateTime;

import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;

public record AuctionSnapshotAuction(
        long auctionId,
        long productId,
        AuctionType auctionType,
        AuctionStatus status,
        AuctionAccessType accessType,
        ProductSnapshot product,
        Long startingPrice,
        LocalDateTime startTime,
        LocalDateTime endTime
) {
}
