package com.group6.auction.realtime.replay;

import java.time.ZoneOffset;

import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;
import org.springframework.stereotype.Service;

@Service
public class ReplayService {
    private final ReplayDataGateway dataGateway;
    private final ReplayTimelineBuilder timelineBuilder;

    public ReplayService(ReplayDataGateway dataGateway, ReplayTimelineBuilder timelineBuilder) {
        this.dataGateway = dataGateway;
        this.timelineBuilder = timelineBuilder;
    }

    public ReplayResponse buildReplay(long auctionId, ReplayViewer viewer) {
        var auction = dataGateway.findAuction(auctionId)
                .orElseThrow(() -> ReplayException.notFound("AUCTION_NOT_FOUND", "Auction was not found."));

        if (auction.status() != AuctionStatus.SOLD && auction.status() != AuctionStatus.UNSOLD) {
            throw ReplayException.conflict("AUCTION_NOT_FINISHED", "Replay is available only after auction finishes.");
        }

        if (!viewer.admin() && !dataGateway.participantExists(auctionId, viewer.userId())) {
            throw ReplayException.forbidden("REPLAY_FORBIDDEN", "Viewer cannot access this replay.");
        }

        var bids = dataGateway.bidsForAuction(auctionId);
        var chatMessages = dataGateway.chatMessagesForAuction(auctionId);
        var historicalStats = auction.auctionType() == AuctionType.BLIND
                ? ReplayHistoricalStats.fromResults(dataGateway.historicalResultsFor(auction.productId(), auction.startTime()))
                : null;

        return new ReplayResponse(
                auction.auctionId(),
                auction.auctionType().name(),
                auction.status().name(),
                viewer.role().name(),
                auction.product(),
                new ReplayResultSnapshot(
                        auction.status().name(),
                        auction.winnerUserId(),
                        auction.winningPrice(),
                        auction.finishedAt() == null ? null : auction.finishedAt().atOffset(ZoneOffset.UTC).toInstant().toString()
                ),
                historicalStats,
                timelineBuilder.build(auction, viewer, bids, chatMessages)
        );
    }
}
