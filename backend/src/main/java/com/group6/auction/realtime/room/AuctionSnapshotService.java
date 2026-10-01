package com.group6.auction.realtime.room;

import java.util.Optional;

import com.group6.auction.auction.entity.AuctionType;
import org.springframework.stereotype.Service;

@Service
public class AuctionSnapshotService {
    private static final int CHAT_HISTORY_LIMIT = 100;

    private final AuctionSnapshotDataGateway dataGateway;
    private final NormalAuctionSnapshotBuilder normalBuilder;
    private final BlindAuctionSnapshotBuilder blindBuilder;

    public AuctionSnapshotService(
            AuctionSnapshotDataGateway dataGateway,
            NormalAuctionSnapshotBuilder normalBuilder,
            BlindAuctionSnapshotBuilder blindBuilder
    ) {
        this.dataGateway = dataGateway;
        this.normalBuilder = normalBuilder;
        this.blindBuilder = blindBuilder;
    }

    public Optional<Object> buildSnapshot(long auctionId, long userId) {
        if (auctionId <= 0 || userId <= 0) {
            return Optional.empty();
        }

        return dataGateway.findAuction(auctionId).map(auction -> {
            var bids = dataGateway.bidsForAuction(auctionId);
            var chatHistory = dataGateway.chatHistoryFor(auctionId, CHAT_HISTORY_LIMIT);
            if (auction.auctionType() == AuctionType.BLIND) {
                var historicalResults = dataGateway.historicalResultsFor(auction.productId(), auction.startTime());
                return (Object) blindBuilder.build(auction, bids, historicalResults, chatHistory, userId);
            }
            return normalBuilder.build(auction, bids, chatHistory);
        });
    }
}
