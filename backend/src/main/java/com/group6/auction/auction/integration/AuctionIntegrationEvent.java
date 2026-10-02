package com.group6.auction.auction.integration;

import com.group6.auction.realtime.protocol.*;

/** Immutable committed facts; do not include entities or unrelated secret fields. */
public sealed interface AuctionIntegrationEvent {
    record NormalAccepted(NormalPriceUpdatedPayload payload) implements AuctionIntegrationEvent {}
    record BlindAccepted(long userId, BlindBidAcceptedPayload payload) implements AuctionIntegrationEvent {}
    record Finished(AuctionFinishedPayload payload) implements AuctionIntegrationEvent {}
}
