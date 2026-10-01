package com.group6.auction.realtime.room;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import com.group6.auction.auction.entity.Auction;
import com.group6.auction.auction.entity.Bid;
import com.group6.auction.auction.repository.AuctionRepository;
import com.group6.auction.auction.repository.BidRepository;
import com.group6.auction.product.entity.Product;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.realtime.chat.ChatMessageSnapshot;
import com.group6.auction.realtime.chat.ChatMessageStore;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Primary
public class JpaAuctionSnapshotDataGateway implements AuctionSnapshotDataGateway {
    private final ObjectProvider<AuctionRepository> auctionRepository;
    private final ObjectProvider<ProductRepository> productRepository;
    private final ObjectProvider<BidRepository> bidRepository;
    private final ObjectProvider<ChatMessageStore> chatMessageStore;

    public JpaAuctionSnapshotDataGateway(
            ObjectProvider<AuctionRepository> auctionRepository,
            ObjectProvider<ProductRepository> productRepository,
            ObjectProvider<BidRepository> bidRepository,
            ObjectProvider<ChatMessageStore> chatMessageStore
    ) {
        this.auctionRepository = auctionRepository;
        this.productRepository = productRepository;
        this.bidRepository = bidRepository;
        this.chatMessageStore = chatMessageStore;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AuctionSnapshotAuction> findAuction(long auctionId) {
        var auctions = auctionRepository.getIfAvailable();
        var products = productRepository.getIfAvailable();
        if (auctions == null || products == null) {
            return Optional.empty();
        }
        return auctions.findById(auctionId)
                .flatMap(auction -> products.findById(auction.getProductId())
                        .map(product -> toSnapshotAuction(auction, product)));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuctionSnapshotBid> bidsForAuction(long auctionId) {
        var bids = bidRepository.getIfAvailable();
        if (bids == null) {
            return List.of();
        }
        return bids.findByAuctionIdOrderByCreatedAtAsc(auctionId).stream()
                .map(this::toSnapshotBid)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuctionSnapshotHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime) {
        var auctions = auctionRepository.getIfAvailable();
        if (auctions == null) {
            return List.of();
        }
        return auctions.findByProductIdAndFinishedAtBefore(productId, beforeStartTime).stream()
                .map(auction -> new AuctionSnapshotHistoricalResult(
                        auction.getWinningPrice(),
                        auction.getStatus(),
                        auction.getFinishedAt()
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessageSnapshot> chatHistoryFor(long auctionId, int limit) {
        var store = chatMessageStore.getIfAvailable();
        return store == null ? List.of() : store.latestMessages(auctionId, limit);
    }

    private AuctionSnapshotAuction toSnapshotAuction(Auction auction, Product product) {
        return new AuctionSnapshotAuction(
                auction.getId(),
                auction.getProductId(),
                auction.getAuctionType(),
                auction.getStatus(),
                auction.getAccessType(),
                new ProductSnapshot(product.getId(), product.getName(), product.getDescription(), product.getImageUrl()),
                auction.getStartingPrice(),
                auction.getStartTime(),
                auction.getEndTime()
        );
    }

    private AuctionSnapshotBid toSnapshotBid(Bid bid) {
        return new AuctionSnapshotBid(
                bid.getId(),
                bid.getAuctionId(),
                bid.getUserId(),
                bid.getAmount(),
                bid.getCreatedAt()
        );
    }
}
