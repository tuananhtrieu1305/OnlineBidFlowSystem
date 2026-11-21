package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;

public record ReplayClueTradeData(long tradeId, int clueSlot, String clueContent,
                                  String seller, String buyer, long price, LocalDateTime createdAt) {}
