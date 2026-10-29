package com.group6.auction.realtime.room;

import java.time.LocalDateTime;
import java.util.Optional;

import com.group6.auction.auction.entity.Auction;
import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionType;
import com.group6.auction.account.repository.UserRepository;
import com.group6.auction.auction.entity.AuctionParticipant;
import com.group6.auction.auction.entity.AuctionParticipantId;
import com.group6.auction.auction.repository.AuctionParticipantRepository;
import com.group6.auction.auction.repository.AuctionRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Primary
public class JpaRoomDataGateway implements RoomDataGateway {
    @Override
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public RoomAccessResult authorizeAndRegister(long userId, long auctionId, String roomCode) {
        var auctions = auctionRepository.getIfAvailable();
        if (auctions == null) return RoomAccessResult.denied("AUCTION_NOT_FOUND", "Auction room was not found.");
        var auction = auctions.findForUpdate(auctionId);
        if (auction.isEmpty())
            return RoomAccessResult.denied("AUCTION_NOT_FOUND", "Auction room was not found.");
        if (auction.get().getAuctionType() == AuctionType.BLIND) {
            var users = userRepository.getIfAvailable();
            if (users == null || users.findById(userId).filter(user -> "USER".equals(user.getRole())).isEmpty())
                return RoomAccessResult.denied("USER_REQUIRED", "Only player accounts can enter a BLIND room.");
        }
        var result = new RoomAccessService(this).validateJoin(userId, auctionId, roomCode);
        if (result.allowed() && !participantExists(auctionId, userId)) ensureParticipant(auctionId, userId);
        return result;
    }
    private final ObjectProvider<AuctionRepository> auctionRepository;
    private final ObjectProvider<AuctionParticipantRepository> participantRepository;
    private final ObjectProvider<UserRepository> userRepository;

    public JpaRoomDataGateway(
            ObjectProvider<AuctionRepository> auctionRepository,
            ObjectProvider<AuctionParticipantRepository> participantRepository,
            ObjectProvider<UserRepository> userRepository
    ) {
        this.auctionRepository = auctionRepository;
        this.participantRepository = participantRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AuctionRoomDetails> findAuction(long auctionId) {
        var repository = auctionRepository.getIfAvailable();
        if (repository == null) {
            return Optional.empty();
        }
        return repository.findById(auctionId).map(this::toDetails);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean participantExists(long auctionId, long userId) {
        var repository = participantRepository.getIfAvailable();
        return repository != null && repository.existsById(new AuctionParticipantId(auctionId, userId));
    }

    @Override
    @Transactional(readOnly = true)
    public long countParticipants(long auctionId) {
        var repository = participantRepository.getIfAvailable();
        return repository == null ? 0 : repository.countByIdAuctionId(auctionId);
    }

    @Override
    @Transactional
    public void ensureParticipant(long auctionId, long userId) {
        var repository = participantRepository.getIfAvailable();
        if (repository == null) {
            return;
        }
        var id = new AuctionParticipantId(auctionId, userId);
        if (!repository.existsById(id)) {
            repository.saveAndFlush(new AuctionParticipant(auctionId, userId, LocalDateTime.now(java.time.ZoneOffset.UTC)));
        }
    }

    private AuctionRoomDetails toDetails(Auction auction) {
        var status = AuctionRoomStatus.valueOf(auction.getStatus().name());
        if (auction.getAuctionType() == AuctionType.BLIND) {
            return new AuctionRoomDetails(auction.getId(),
                    auction.getAccessType() == AuctionAccessType.PRIVATE ? AuctionRoomAccessType.PRIVATE : AuctionRoomAccessType.PUBLIC,
                    status, auction.getRoomCode(), 4);
        }
        if (auction.getAccessType() == AuctionAccessType.PRIVATE) {
            return AuctionRoomDetails.privateRoom(
                    auction.getId(),
                    status,
                    auction.getRoomCode(),
                    auction.getMaxParticipants()
            );
        }
        return AuctionRoomDetails.publicRoom(auction.getId(), status);
    }
}
