package com.group6.auction.auction.integration;

import com.group6.auction.realtime.protocol.*;
import com.group6.auction.wallet.service.WalletException;
import com.group6.auction.wallet.service.WalletTransferService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Objects;

/** Internal bridge for validated decisions from NORMAL/BLIND, never a client-facing API.
 * Caller locks the auction BEFORE reading bids, validates rules and flushes its saved bid.
 * JDBC result writes share the caller transaction; refresh any managed Auction afterwards.
 */
@Service
@Profile("!probe")
@Transactional(propagation = Propagation.MANDATORY)
public class AuctionWalletIntegration {
    private final JdbcTemplate jdbc;
    private final WalletTransferService wallets;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public AuctionWalletIntegration(JdbcTemplate jdbc, WalletTransferService wallets,
                                   ApplicationEventPublisher events, Clock clock) {
        this.jdbc = jdbc;
        this.wallets = wallets;
        this.events = events;
        this.clock = clock;
    }

    private record Auction(String type, String status, long floor, Long winner, Long price) {}
    private record Bid(long userId, long amount) {}

    private Auction lockAuction(long id) {
        if (!Objects.equals(TransactionSynchronizationManager.getCurrentTransactionIsolationLevel(),
                TransactionDefinition.ISOLATION_READ_COMMITTED)) {
            throw new IllegalTransactionStateException("Auction integration requires explicit READ_COMMITTED isolation");
        }
        var rows = jdbc.query("SELECT auction_type,status,starting_price,winner_user_id,winning_price FROM auctions WHERE id=? FOR UPDATE",
                (rs, n) -> new Auction(rs.getString(1), rs.getString(2), rs.getLong(3),
                        rs.getObject(4, Long.class), rs.getObject(5, Long.class)), id);
        if (rows.size() != 1) throw new WalletException(404, "AUCTION_NOT_FOUND");
        return rows.getFirst();
    }

    private Bid bid(long auctionId, long bidId) {
        var rows = jdbc.query("""
                SELECT b.user_id,b.amount FROM bids b
                JOIN users u ON u.id=b.user_id AND u.role='USER'
                JOIN auction_participants p ON p.auction_id=b.auction_id AND p.user_id=b.user_id
                WHERE b.auction_id=? AND b.id=?
                """, (rs, n) -> new Bid(rs.getLong(1), rs.getLong(2)), auctionId, bidId);
        if (rows.size() != 1 || rows.getFirst().amount() <= 0)
            throw WalletException.conflict("INVALID_ACCEPTED_BID");
        return rows.getFirst();
    }

    private void requireRunning(Auction auction, String type) {
        if (!"RUNNING".equals(auction.status())) throw WalletException.conflict("AUCTION_NOT_RUNNING");
        if (!type.equals(auction.type())) throw WalletException.conflict("AUCTION_TYPE_MISMATCH");
    }

    public void normalBidAccepted(long auctionId, long bidId, Long previousLeaderUserId, long nextMinimumBid) {
        requireRunning(lockAuction(auctionId), "NORMAL");
        var bid = bid(auctionId, bidId);
        if (nextMinimumBid <= bid.amount()) throw WalletException.conflict("INVALID_NEXT_MINIMUM_BID");
        wallets.replaceLeader(auctionId, previousLeaderUserId, bid.userId(), bid.amount());
        events.publishEvent(new AuctionIntegrationEvent.NormalAccepted(
                new NormalPriceUpdatedPayload(auctionId, bid.amount(), nextMinimumBid, bid.userId())));
    }

    public void blindBidAccepted(long auctionId, long bidId) {
        requireRunning(lockAuction(auctionId), "BLIND");
        var bid = bid(auctionId, bidId);
        wallets.lockToAmount(auctionId, bid.userId(), bid.amount());
        events.publishEvent(new AuctionIntegrationEvent.BlindAccepted(bid.userId(),
                new BlindBidAcceptedPayload(auctionId, bid.amount(), Long.toString(bidId))));
    }

    /** Winner selection and time checks belong to the caller; persist only a backed decision. */
    public void finishSold(long auctionId, long winnerUserId, long winningAmount) {
        var auction = lockAuction(auctionId);
        if ("SOLD".equals(auction.status())) {
            if (!Objects.equals(auction.winner(), winnerUserId) || !Objects.equals(auction.price(), winningAmount))
                throw WalletException.conflict("SETTLEMENT_CONFLICT");
            wallets.settleAuction(auctionId, winnerUserId, winningAmount);
            return;
        }
        if (!"RUNNING".equals(auction.status())) throw WalletException.conflict("INVALID_SETTLEMENT");
        if (winningAmount < auction.floor() || winningAmount <= 0 || winnerUserId <= 0)
            throw WalletException.conflict("INVALID_WINNING_BID");
        var count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM bids b JOIN users u ON u.id=b.user_id AND u.role='USER'
                JOIN auction_participants p ON p.auction_id=b.auction_id AND p.user_id=b.user_id
                WHERE b.auction_id=? AND b.user_id=? AND b.amount=?
                """, Long.class, auctionId, winnerUserId, winningAmount);
        if (count == null || count == 0) throw WalletException.conflict("INVALID_WINNING_BID");
        wallets.settleAuction(auctionId, winnerUserId, winningAmount);
        jdbc.update("UPDATE auctions SET status='SOLD',winner_user_id=?,winning_price=?,finished_at=? WHERE id=?",
                winnerUserId, winningAmount, LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC), auctionId);
        events.publishEvent(new AuctionIntegrationEvent.Finished(
                new AuctionFinishedPayload(auctionId, "SOLD", winnerUserId, winningAmount)));
    }

    public void finishUnsold(long auctionId) {
        var auction = lockAuction(auctionId);
        if (!"RUNNING".equals(auction.status()) && !"UNSOLD".equals(auction.status()))
            throw WalletException.conflict("INVALID_SETTLEMENT");
        wallets.releaseAuction(auctionId);
        if ("UNSOLD".equals(auction.status())) return;
        jdbc.update("UPDATE auctions SET status='UNSOLD',winner_user_id=NULL,winning_price=NULL,finished_at=? WHERE id=?",
                LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC), auctionId);
        events.publishEvent(new AuctionIntegrationEvent.Finished(
                new AuctionFinishedPayload(auctionId, "UNSOLD", null, null)));
    }
}
