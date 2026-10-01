package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.auction.entity.AuctionAccessType;
import com.group6.auction.auction.entity.AuctionStatus;
import com.group6.auction.auction.entity.AuctionType;
import com.group6.auction.realtime.connection.RealtimePrincipal;
import com.group6.auction.realtime.room.ProductSnapshot;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReplayServiceTest {
    private final FakeReplayDataGateway gateway = new FakeReplayDataGateway();
    private final ReplayService service = new ReplayService(gateway, new ReplayTimelineBuilder());
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void normalReplayIncludesAllBidsAndChat() throws Exception {
        gateway.auction = normalAuction(AuctionStatus.SOLD);
        gateway.participants.put(key(1L, 2L), true);
        gateway.bids.add(new ReplayBidData(10L, 1L, 2L, 1200L, at(9, 10)));
        gateway.bids.add(new ReplayBidData(11L, 1L, 3L, 1500L, at(9, 20)));
        gateway.chatMessages.add(new ReplayChatData(5L, 1L, 3L, "bob", "Nice item", at(9, 15)));

        var replay = service.buildReplay(1L, viewer(2L, RealtimePrincipal.Role.USER));
        var json = objectMapper.writeValueAsString(replay);

        assertThat(replay.events()).extracting(ReplayTimelineEvent::type)
                .containsExactly("AUCTION_STARTED", "BID_PLACED", "CHAT_MESSAGE", "BID_PLACED", "AUCTION_FINISHED");
        assertThat(json).contains("\"auctionType\":\"NORMAL\"")
                .contains("\"amount\":1200")
                .contains("\"amount\":1500")
                .contains("\"content\":\"Nice item\"")
                .contains("\"winnerUserId\":3")
                .doesNotContain("estimatedPrice");
    }

    @Test
    void runningAuctionReplayIsRejected() {
        gateway.auction = normalAuction(AuctionStatus.RUNNING);
        gateway.participants.put(key(1L, 2L), true);

        assertThatThrownBy(() -> service.buildReplay(1L, viewer(2L, RealtimePrincipal.Role.USER)))
                .isInstanceOf(ReplayException.class)
                .extracting("code")
                .isEqualTo("AUCTION_NOT_FINISHED");
    }

    @Test
    void blindUserReplayIncludesOwnBidOnly() throws Exception {
        gateway.auction = blindAuction(AuctionStatus.SOLD);
        gateway.participants.put(key(3L, 2L), true);
        gateway.bids.add(new ReplayBidData(20L, 3L, 2L, 1600L, at(9, 10)));
        gateway.bids.add(new ReplayBidData(21L, 3L, 6L, 2400L, at(9, 12)));
        gateway.historicalResults.add(new ReplayHistoricalResult(1500L, AuctionStatus.SOLD, at(8, 0)));
        gateway.historicalResults.add(new ReplayHistoricalResult(1800L, AuctionStatus.SOLD, at(8, 30)));
        gateway.historicalResults.add(new ReplayHistoricalResult(null, AuctionStatus.UNSOLD, at(8, 45)));

        var replay = service.buildReplay(3L, viewer(2L, RealtimePrincipal.Role.USER));
        var json = objectMapper.writeValueAsString(replay);

        assertThat(json).contains("\"auctionType\":\"BLIND\"")
                .contains("\"amount\":1600")
                .contains("\"winnerUserId\":2")
                .contains("\"winningPrice\":1600")
                .contains("\"soldCount\":2")
                .contains("\"averageWinningPrice\":1650")
                .doesNotContain("\"bidId\":21")
                .doesNotContain("\"amount\":2400")
                .doesNotContain("\"userId\":6")
                .doesNotContain("\"ownBid\":false")
                .doesNotContain("\"startingPrice\"")
                .doesNotContain("estimatedPrice");
        var bidEvents = replay.events().stream()
                .filter(event -> event.type().equals("BID_PLACED"))
                .toList();
        assertThat(bidEvents).hasSize(1);
        assertThat(objectMapper.writeValueAsString(bidEvents.getFirst().payload()))
                .contains("\"ownBid\":true")
                .doesNotContain("\"userId\":6");
    }

    @Test
    void blindAdminReplayIncludesFullBidList() throws Exception {
        gateway.auction = blindAuction(AuctionStatus.SOLD);
        gateway.bids.add(new ReplayBidData(20L, 3L, 2L, 1600L, at(9, 10)));
        gateway.bids.add(new ReplayBidData(21L, 3L, 6L, 2400L, at(9, 12)));

        var replay = service.buildReplay(3L, viewer(1L, RealtimePrincipal.Role.ADMIN));
        var json = objectMapper.writeValueAsString(replay);

        assertThat(json).contains("\"amount\":1600")
                .contains("\"amount\":2400")
                .contains("\"userId\":6")
                .doesNotContain("estimatedPrice");
    }

    @Test
    void nonParticipantUserIsRejected() {
        gateway.auction = normalAuction(AuctionStatus.SOLD);

        assertThatThrownBy(() -> service.buildReplay(1L, viewer(9L, RealtimePrincipal.Role.USER)))
                .isInstanceOf(ReplayException.class)
                .extracting("code")
                .isEqualTo("REPLAY_FORBIDDEN");
    }

    @Test
    void adminCanViewReplayWithoutBeingParticipant() {
        gateway.auction = normalAuction(AuctionStatus.SOLD);

        var replay = service.buildReplay(1L, viewer(1L, RealtimePrincipal.Role.ADMIN));

        assertThat(replay.viewerRole()).isEqualTo("ADMIN");
        assertThat(replay.auctionId()).isEqualTo(1L);
    }

    private ReplayViewer viewer(long userId, RealtimePrincipal.Role role) {
        return new ReplayViewer(userId, role);
    }

    private ReplayAuctionData normalAuction(AuctionStatus status) {
        return new ReplayAuctionData(
                1L,
                1L,
                AuctionType.NORMAL,
                status,
                AuctionAccessType.PUBLIC,
                product(),
                1000L,
                at(9, 0),
                at(10, 0),
                status == AuctionStatus.RUNNING ? null : at(10, 0),
                status == AuctionStatus.SOLD ? 3L : null,
                status == AuctionStatus.SOLD ? 1500L : null
        );
    }

    private ReplayAuctionData blindAuction(AuctionStatus status) {
        return new ReplayAuctionData(
                3L,
                1L,
                AuctionType.BLIND,
                status,
                AuctionAccessType.PRIVATE,
                product(),
                1300L,
                at(9, 0),
                at(10, 0),
                status == AuctionStatus.RUNNING ? null : at(10, 0),
                status == AuctionStatus.SOLD ? 2L : null,
                status == AuctionStatus.SOLD ? 1600L : null
        );
    }

    private ProductSnapshot product() {
        return new ProductSnapshot(1L, "Vintage Camera", "Classic film camera", "camera.jpg");
    }

    private static LocalDateTime at(int hour, int minute) {
        return LocalDateTime.of(2026, 8, 30, hour, minute);
    }

    private static String key(long auctionId, long userId) {
        return auctionId + ":" + userId;
    }

    private static final class FakeReplayDataGateway implements ReplayDataGateway {
        private ReplayAuctionData auction;
        private final Map<String, Boolean> participants = new HashMap<>();
        private final List<ReplayBidData> bids = new ArrayList<>();
        private final List<ReplayChatData> chatMessages = new ArrayList<>();
        private final List<ReplayHistoricalResult> historicalResults = new ArrayList<>();

        @Override
        public Optional<ReplayAuctionData> findAuction(long auctionId) {
            return Optional.ofNullable(auction);
        }

        @Override
        public boolean participantExists(long auctionId, long userId) {
            return participants.containsKey(key(auctionId, userId));
        }

        @Override
        public List<ReplayBidData> bidsForAuction(long auctionId) {
            return bids.stream().filter(bid -> bid.auctionId() == auctionId).toList();
        }

        @Override
        public List<ReplayChatData> chatMessagesForAuction(long auctionId) {
            return chatMessages.stream().filter(message -> message.auctionId() == auctionId).toList();
        }

        @Override
        public List<ReplayHistoricalResult> historicalResultsFor(long productId, LocalDateTime beforeStartTime) {
            return historicalResults;
        }
    }
}
