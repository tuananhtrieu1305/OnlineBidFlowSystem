package com.group6.auction.wallet.dto;
public record TransactionResponse(String id,String auctionId,String type,String availableDelta,String lockedDelta,String createdAt) {}
