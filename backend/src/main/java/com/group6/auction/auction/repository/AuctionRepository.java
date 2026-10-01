package com.group6.auction.auction.repository;

import java.time.LocalDateTime;
import java.util.List;

import com.group6.auction.auction.entity.Auction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuctionRepository extends JpaRepository<Auction, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from Auction a where a.id = :id")
    java.util.Optional<Auction> findForUpdate(@org.springframework.data.repository.query.Param("id") long id);
    List<Auction> findByProductIdAndFinishedAtBefore(Long productId, LocalDateTime finishedBefore);
}
