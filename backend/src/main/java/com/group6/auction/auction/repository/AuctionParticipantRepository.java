package com.group6.auction.auction.repository;

import com.group6.auction.auction.entity.AuctionParticipant;
import com.group6.auction.auction.entity.AuctionParticipantId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuctionParticipantRepository extends JpaRepository<AuctionParticipant, AuctionParticipantId> {
    long countByIdAuctionId(Long auctionId);
}
