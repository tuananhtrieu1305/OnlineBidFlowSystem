package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import com.group6.auction.account.repository.UserRepository;
import com.group6.auction.auction.entity.Auction;
import com.group6.auction.auction.entity.AuctionParticipantId;
import com.group6.auction.auction.entity.Bid;
import com.group6.auction.auction.repository.AuctionParticipantRepository;
import com.group6.auction.auction.repository.AuctionRepository;
import com.group6.auction.auction.repository.BidRepository;
import com.group6.auction.product.entity.Product;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.realtime.chat.ChatMessageEntity;
import com.group6.auction.realtime.chat.ChatMessageRepository;
import com.group6.auction.realtime.room.ProductSnapshot;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Primary
public class JpaReplayDataGateway implements ReplayDataGateway {
    private final ObjectProvider<AuctionRepository> auctionRepository;
    private final ObjectProvider<ProductRepository> productRepository;
    private final ObjectProvider<AuctionParticipantRepository> participantRepository;
    private final ObjectProvider<BidRepository> bidRepository;
    private final ObjectProvider<ChatMessageRepository> chatMessageRepository;
    private final ObjectProvider<UserRepository> userRepository;

    public JpaReplayDataGateway(
            ObjectProvider<AuctionRepository> auctionRepository,
            ObjectProvider<ProductRepository> productRepository,
            ObjectProvider<AuctionParticipantRepository> participantRepository,
            ObjectProvider<BidRepository> bidRepository,
            ObjectProvider<ChatMessageRepository> chatMessageRepository,
            ObjectProvider<UserRepository> userRepository
    ) {
        this.auctionRepository = auctionRepository;
        this.productRepository = productRepository;
        this.participantRepository = participantRepository;
        this.bidRepository = bidRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ReplayAuctionData> findAuction(long auctionId) {
        var auctions = auctionRepository.getIfAvailable();
        var products = productRepository.getIfAvailable();
        if (auctions == null || products == null) {
            return Optional.empty();
        }
        return auctions.findById(auctionId)
                .flatMap(auction -> products.findById(auction.getProductId())
                        .map(product -> toReplayAuction(auction, product)));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean participantExists(long auctionId, long userId) {
        var participants = participantRepository.getIfAvailable();
        return participants != null && participants.existsById(new AuctionParticipantId(auctionId, userId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReplayBidData> bidsForAuction(long auctionId) {
        var bids = bidRepository.getIfAvailable();
        if (bids == null) {
            return List.of();
        }
        return bids.findByAuctionIdOrderByCreatedAtAsc(auctionId).stream()
                .map(this::toReplayBid)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReplayChatData> chatMessagesForAuction(long auctionId) {
        var chats = chatMessageRepository.getIfAvailable();
        if (chats == null) {
            return List.of();
        }
        var messages = chats.findByAuctionIdOrderBySentAtAsc(auctionId);
        var usernames = usernamesFor(messages);
        return messages.stream()
                .map(message -> toReplayChat(message, usernames.getOrDefault(message.getUserId(), "user-" + message.getUserId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReplayHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime) {
        var auctions = auctionRepository.getIfAvailable();
        if (auctions == null) {
            return List.of();
        }
        return auctions.findByProductIdAndFinishedAtBefore(productId, beforeStartTime).stream()
                .map(auction -> new ReplayHistoricalResult(
                        auction.getWinningPrice(),
                        auction.getStatus(),
                        auction.getFinishedAt()
                ))
                .toList();
    }

    private ReplayAuctionData toReplayAuction(Auction auction, Product product) {
        return new ReplayAuctionData(
                auction.getId(),
                auction.getProductId(),
                auction.getAuctionType(),
                auction.getStatus(),
                auction.getAccessType(),
                new ProductSnapshot(product.getId(), product.getName(), product.getDescription(), product.getImageUrl()),
                auction.getStartingPrice(),
                auction.getStartTime(),
                auction.getEndTime(),
                auction.getFinishedAt(),
                auction.getWinnerUserId(),
                auction.getWinningPrice()
        );
    }

    private ReplayBidData toReplayBid(Bid bid) {
        return new ReplayBidData(
                bid.getId(),
                bid.getAuctionId(),
                bid.getUserId(),
                bid.getAmount(),
                bid.getCreatedAt()
        );
    }

    private ReplayChatData toReplayChat(ChatMessageEntity message, String username) {
        return new ReplayChatData(
                message.getId(),
                message.getAuctionId(),
                message.getUserId(),
                username,
                message.getContent(),
                message.getSentAt()
        );
    }

    private Map<Long, String> usernamesFor(List<ChatMessageEntity> messages) {
        var userIds = messages.stream().map(ChatMessageEntity::getUserId).distinct().toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        var users = userRepository.getIfAvailable();
        if (users == null) {
            return Map.of();
        }
        return users.findAllById(userIds).stream()
                .collect(Collectors.toMap(user -> user.getId(), user -> user.getUsername()));
    }
}
