package com.group6.auction.auction.normal;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import com.group6.auction.wallet.dto.WalletResponse;

public final class NormalDtos {
    private NormalDtos() {}
    public record Product(long id, String name, String description, int quantity, String imageUrl) {}
    public record Bid(long id, long userId, String username, long amount, Instant createdAt) {}
    public record Summary(long id, Product product, String access, String status, Instant startsAt, Instant endsAt, boolean joined) {}
    public record Snapshot(long id, Product product, String access, String status, long startingPrice,
                           long increment, Instant startsAt, Instant endsAt, Instant finishedAt, long currentPrice,
                           Bid leader, List<Bid> bids, String winner, Long winningPrice, boolean joined, Instant serverTime, com.group6.auction.auction.configuration.NormalTimingRepository.Timing normalTiming, Instant scheduledEndsAt) {}
    public record BidRequest(@NotNull @Positive @Max(9007199254740991L) Long amount) {}
    public record JoinRequest(@Size(max = 50) String roomCode) {}
    public record BidResponse(Snapshot auction, WalletResponse wallet) {}
}
