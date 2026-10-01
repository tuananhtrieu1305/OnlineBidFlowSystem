package com.group6.auction.auction.entity;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class AuctionParticipantId implements Serializable {
    @Column(name = "auction_id")
    private Long auctionId;

    @Column(name = "user_id")
    private Long userId;

    protected AuctionParticipantId() {
    }

    public AuctionParticipantId(Long auctionId, Long userId) {
        this.auctionId = auctionId;
        this.userId = userId;
    }

    public Long getAuctionId() {
        return auctionId;
    }

    public Long getUserId() {
        return userId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof AuctionParticipantId that)) {
            return false;
        }
        return Objects.equals(auctionId, that.auctionId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(auctionId, userId);
    }
}
