package com.group6.auction.auction.repository;

import java.time.LocalDateTime;
import java.util.List;

import com.group6.auction.auction.entity.Auction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuctionRepository extends JpaRepository<Auction, Long> {
    List<Auction> findByProductIdAndFinishedAtBefore(Long productId, LocalDateTime finishedBefore);
}
