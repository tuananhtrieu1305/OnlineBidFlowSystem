package com.group6.auction.auction.repository;

import java.util.List;

import com.group6.auction.auction.entity.Bid;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BidRepository extends JpaRepository<Bid, Long> {
    List<Bid> findByAuctionIdOrderByCreatedAtAsc(Long auctionId);
}
