package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;

import com.group6.auction.auction.entity.AuctionStatus;

public record ReplayHistoricalResult(Long winningPrice, AuctionStatus status, LocalDateTime finishedAt) {
}
