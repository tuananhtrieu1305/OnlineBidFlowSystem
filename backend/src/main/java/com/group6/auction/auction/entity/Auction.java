package com.group6.auction.auction.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "auctions")
public class Auction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "auction_type", nullable = false, length = 30)
    private AuctionType auctionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_type", nullable = false, length = 20)
    private AuctionAccessType accessType;

    @Column(name = "room_code", length = 50)
    private String roomCode;

    @Column(name = "max_participants")
    private Integer maxParticipants;

    @Column(name = "starting_price", nullable = false)
    private Long startingPrice;

    @Column(name = "min_bid_increment")
    private Long minBidIncrement;

    @Column(name = "start_time", nullable = false)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LOCAL_DATE_TIME)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LOCAL_DATE_TIME)
    private LocalDateTime endTime;

    @Column(name = "finished_at")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LOCAL_DATE_TIME)
    private LocalDateTime finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuctionStatus status;

    @Column(name = "winner_user_id")
    private Long winnerUserId;

    @Column(name = "winning_price")
    private Long winningPrice;

    protected Auction() {
    }

    public static Auction create(long productId, long createdBy, AuctionType type, AuctionAccessType access,
            long price, Long increment, Integer capacity, String code, LocalDateTime start, LocalDateTime end) {
        Auction auction = new Auction();
        auction.productId = productId;
        auction.createdBy = createdBy;
        auction.status = AuctionStatus.UPCOMING;
        auction.configure(type, access, price, increment, capacity, code, start, end);
        return auction;
    }

    public void configure(AuctionType type, AuctionAccessType access, long price, Long increment,
            Integer capacity, String code, LocalDateTime start, LocalDateTime end) {
        this.auctionType = type;
        this.accessType = access;
        this.startingPrice = price;
        this.minBidIncrement = increment;
        this.maxParticipants = capacity;
        this.roomCode = code;
        this.startTime = start;
        this.endTime = end;
    }

    public Long getId() {
        return id;
    }

    public Long getProductId() {
        return productId;
    }

    public AuctionType getAuctionType() {
        return auctionType;
    }

    public AuctionAccessType getAccessType() {
        return accessType;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public Integer getMaxParticipants() {
        return maxParticipants;
    }

    public AuctionStatus getStatus() {
        return status;
    }

    public Long getStartingPrice() {
        return startingPrice;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public LocalDateTime getFinishedAt() {
        return finishedAt;
    }

    public Long getWinningPrice() {
        return winningPrice;
    }

    public Long getWinnerUserId() {
        return winnerUserId;
    }
}
