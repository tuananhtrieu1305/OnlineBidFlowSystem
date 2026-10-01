package com.group6.auction.auction.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "auction_participants")
public class AuctionParticipant {
    @EmbeddedId
    private AuctionParticipantId id;

    @Column(name = "joined_at", nullable = false)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LOCAL_DATE_TIME)
    private LocalDateTime joinedAt;

    protected AuctionParticipant() {
    }

    public AuctionParticipant(Long auctionId, Long userId, LocalDateTime joinedAt) {
        this.id = new AuctionParticipantId(auctionId, userId);
        this.joinedAt = joinedAt;
    }

    public AuctionParticipantId getId() {
        return id;
    }

    public LocalDateTime getJoinedAt() {
        return joinedAt;
    }
}
