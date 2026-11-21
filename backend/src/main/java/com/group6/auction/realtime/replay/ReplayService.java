package com.group6.auction.realtime.replay;

import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;

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

        if (auction.status() != AuctionStatus.SOLD && auction.status() != AuctionStatus.UNSOLD && auction.status() != AuctionStatus.CANCELLED) {
            throw ReplayException.conflict("AUCTION_NOT_FINISHED", "Replay is available only after auction finishes.");
        }

        if (!viewer.admin() && !dataGateway.participantExists(auctionId, viewer.userId())) {
            throw ReplayException.forbidden("REPLAY_FORBIDDEN", "Viewer cannot access this replay.");
        }

        var bids = dataGateway.bidsForAuction(auctionId);
        boolean blind=auction.auctionType()==AuctionType.BLIND;
        var names=blind?dataGateway.bidderNamesForAuction(auctionId):java.util.Map.<Long,String>of();
        List<ReplayTimelineEvent> events=blind
                ? timelineBuilder.buildBlind(auction,viewer,bids,dataGateway.clueTradesForAuction(auctionId),names)
                : timelineBuilder.build(auction,viewer,bids,dataGateway.chatMessagesForAuction(auctionId));
        List<ReplayTopBid> topBids=null;
        if(blind){
            var latest=new HashMap<Long,ReplayBidData>();
            for(var bid:bids){
                var old=latest.get(bid.userId());
                if(old==null||bid.createdAt().isAfter(old.createdAt())||
                   (bid.createdAt().equals(old.createdAt())&&bid.bidId()>old.bidId()))latest.put(bid.userId(),bid);
            }
            topBids=latest.values().stream()
                    .sorted(Comparator.comparingLong(ReplayBidData::amount).reversed()
                            .thenComparing(ReplayBidData::createdAt).thenComparingLong(ReplayBidData::bidId))
                    .limit(3).map(bid->new ReplayTopBid(bid.userId(),names.getOrDefault(bid.userId(),"Người chơi #"+bid.userId()),bid.amount())).toList();
        }

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
                null,
                events,
                topBids
        );
    }
}
