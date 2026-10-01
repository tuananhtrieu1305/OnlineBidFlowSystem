package com.group6.auction.realtime.room;

import java.time.LocalDateTime;
import java.util.Optional;

import com.group6.auction.auction.entity.Auction;
import com.group6.auction.auction.entity.AuctionAccessType;
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
    private final ObjectProvider<AuctionRepository> auctionRepository;
    private final ObjectProvider<AuctionParticipantRepository> participantRepository;

    public JpaRoomDataGateway(
            ObjectProvider<AuctionRepository> auctionRepository,
            ObjectProvider<AuctionParticipantRepository> participantRepository
    ) {
        this.auctionRepository = auctionRepository;
        this.participantRepository = participantRepository;
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
            repository.save(new AuctionParticipant(auctionId, userId, LocalDateTime.now()));
        }
    }

    private AuctionRoomDetails toDetails(Auction auction) {
        var status = AuctionRoomStatus.valueOf(auction.getStatus().name());
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
