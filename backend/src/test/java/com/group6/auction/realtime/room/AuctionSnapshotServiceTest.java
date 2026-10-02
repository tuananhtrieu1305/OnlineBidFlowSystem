package com.group6.auction.realtime.room;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;
import com.group6.auction.realtime.chat.ChatMessageSnapshot;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuctionSnapshotServiceTest {
    @Test
    void utcDeadlinesRemainCorrectWhenServerUsesVietnamTimezone() {
        var previous = java.util.TimeZone.getDefault();
        try {
            java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
            var now = LocalDateTime.now(java.time.ZoneOffset.UTC);
            for (var type : AuctionType.values()) {
                var auction = new AuctionSnapshotAuction(1L, 1L, type, AuctionStatus.RUNNING,
                        AuctionAccessType.PUBLIC, new ProductSnapshot(1L, "Camera", "Demo", null),
                        100L, now.minusMinutes(1), now.plusMinutes(10));
                long remaining = type == AuctionType.NORMAL
                        ? new NormalAuctionSnapshotBuilder().build(auction, List.of(), List.of()).remainingSeconds()
                        : new BlindAuctionSnapshotBuilder().build(auction, List.of(), List.of(), List.of(), 2L).remainingSeconds();
                assertThat(remaining).isBetween(590L, 600L);
            }
        } finally { java.util.TimeZone.setDefault(previous); }
    }
    private final FakeAuctionSnapshotDataGateway gateway = new FakeAuctionSnapshotDataGateway();
    private final AuctionSnapshotService service = new AuctionSnapshotService(
            gateway,
            new NormalAuctionSnapshotBuilder(),
            new BlindAuctionSnapshotBuilder()
    );
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void normalSnapshotIncludesStartingAndCurrentPrice() throws Exception {
        gateway.auction = normalAuction();
        gateway.bids.add(new AuctionSnapshotBid(10L, 1L, 3L, 1200L, at(9, 10)));
        gateway.bids.add(new AuctionSnapshotBid(11L, 1L, 4L, 1500L, at(9, 12)));
        gateway.chatMessages.add(new ChatMessageSnapshot(1L, 1L, 2L, "alice", "Ready", "2026-08-30T09:13:00Z"));

        var snapshot = service.buildSnapshot(1L, 2L).orElseThrow();
        var json = objectMapper.writeValueAsString(snapshot);

        assertThat(json).contains("\"auctionType\":\"NORMAL\"")
                .contains("\"startingPrice\":1000")
                .contains("\"currentPrice\":1500")
                .contains("\"bidHistory\"")
                .contains("\"currentLeader\"")
                .contains("\"userId\":4")
                .contains("\"chatHistory\"")
                .contains("\"content\":\"Ready\"");
    }

    @Test
    void normalSnapshotExcludesEstimatedPriceAndHistoricalStatsWhileRunning() throws Exception {
        gateway.auction = normalAuction();

        var snapshot = service.buildSnapshot(1L, 2L).orElseThrow();
        var json = objectMapper.writeValueAsString(snapshot);

        assertThat(json).doesNotContain("estimatedPrice")
                .doesNotContain("historicalStats")
                .doesNotContain("averageWinningPrice");
    }

    @Test
    void blindSnapshotIncludesOwnBidOnlyAndHistoricalSoldStats() throws Exception {
        gateway.auction = blindAuction();
        gateway.bids.add(new AuctionSnapshotBid(20L, 3L, 2L, 1600L, at(9, 5)));
        gateway.bids.add(new AuctionSnapshotBid(21L, 3L, 4L, 2400L, at(9, 6)));
        gateway.historicalResults.add(new AuctionSnapshotHistoricalResult(1500L, AuctionStatus.SOLD, at(8, 0)));
        gateway.historicalResults.add(new AuctionSnapshotHistoricalResult(1800L, AuctionStatus.SOLD, at(8, 30)));
        gateway.historicalResults.add(new AuctionSnapshotHistoricalResult(null, AuctionStatus.UNSOLD, at(8, 45)));

        var snapshot = service.buildSnapshot(3L, 2L).orElseThrow();
        var json = objectMapper.writeValueAsString(snapshot);

        assertThat(json).contains("\"auctionType\":\"BLIND\"")
                .contains("\"ownBid\"")
                .contains("\"amount\":1600")
                .contains("\"soldCount\":2")
                .contains("\"averageWinningPrice\":1650")
                .contains("\"minimumWinningPrice\":1500")
                .contains("\"maximumWinningPrice\":1800");
        assertThat(json).doesNotContain("\"amount\":2400")
                .doesNotContain("\"userId\":4");
    }

    @Test
    void blindSnapshotDoesNotExposePublicAuctionFields() throws Exception {
        gateway.auction = blindAuction();

        var snapshot = service.buildSnapshot(3L, 2L).orElseThrow();
        var json = objectMapper.writeValueAsString(snapshot);

        assertThat(json).doesNotContain("startingPrice")
                .doesNotContain("currentPrice")
                .doesNotContain("bidHistory")
                .doesNotContain("currentLeader")
                .doesNotContain("estimatedPrice");
    }

    private AuctionSnapshotAuction normalAuction() {
        return new AuctionSnapshotAuction(
                1L,
                1L,
                AuctionType.NORMAL,
                AuctionStatus.RUNNING,
                AuctionAccessType.PUBLIC,
                new ProductSnapshot(1L, "Vintage Camera", "Classic film camera", "camera.jpg"),
                1000L,
                at(9, 0),
                at(10, 0)
        );
    }

    private AuctionSnapshotAuction blindAuction() {
        return new AuctionSnapshotAuction(
                3L,
                1L,
                AuctionType.BLIND,
                AuctionStatus.RUNNING,
                AuctionAccessType.PRIVATE,
                new ProductSnapshot(1L, "Vintage Camera", "Classic film camera", "camera.jpg"),
                1300L,
                at(9, 0),
                at(10, 0)
        );
    }

    private LocalDateTime at(int hour, int minute) {
        return LocalDateTime.of(2026, 8, 30, hour, minute);
    }

    private static final class FakeAuctionSnapshotDataGateway implements AuctionSnapshotDataGateway {
        private AuctionSnapshotAuction auction;
        private final List<AuctionSnapshotBid> bids = new ArrayList<>();
        private final List<AuctionSnapshotHistoricalResult> historicalResults = new ArrayList<>();
        private final List<ChatMessageSnapshot> chatMessages = new ArrayList<>();

        @Override
        public Optional<AuctionSnapshotAuction> findAuction(long auctionId) {
            return auction != null && auction.auctionId() == auctionId ? Optional.of(auction) : Optional.empty();
        }

        @Override
        public List<AuctionSnapshotBid> bidsForAuction(long auctionId) {
            return bids.stream().filter(bid -> bid.auctionId() == auctionId).toList();
        }

        @Override
        public List<AuctionSnapshotHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime) {
            return historicalResults;
        }

        @Override
        public List<ChatMessageSnapshot> chatHistoryFor(long auctionId, int limit) {
            return chatMessages.stream()
                    .filter(message -> message.auctionId() == auctionId)
                    .limit(limit)
                    .toList();
        }
    }
}
