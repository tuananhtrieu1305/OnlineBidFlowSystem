package com.group6.auction.realtime.room;

import java.time.LocalDateTime;

import com.group6.auction.auction.entity.AuctionStatus;

public record AuctionSnapshotHistoricalResult(Long winningPrice, AuctionStatus status, LocalDateTime finishedAt) {
}
