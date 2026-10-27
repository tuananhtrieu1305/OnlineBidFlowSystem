package com.group6.auction.auction.normal;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import com.group6.auction.auction.normal.NormalDtos.*;
import com.group6.auction.auction.normal.NormalRepository.Account;
import com.group6.auction.auction.normal.NormalRepository.Auction;
import com.group6.auction.wallet.service.WalletLedger;
import com.group6.auction.auction.integration.AuctionWalletIntegration;
import com.group6.auction.realtime.room.RoomAccessService;

@Service
@Profile("!probe")
@ConditionalOnProperty(name = "app.normal.enabled", havingValue = "true", matchIfMissing = true)
public class NormalService {
    private final NormalRepository repository;
    private final WalletLedger wallets;
    private final AuctionWalletIntegration integration;
    private final RoomAccessService rooms;
    private final Clock clock;
    private final com.group6.auction.auction.configuration.NormalTimingRepository timings;
    public NormalService(NormalRepository repository, WalletLedger wallets, AuctionWalletIntegration integration, RoomAccessService rooms, Clock clock, com.group6.auction.auction.configuration.NormalTimingRepository timings) {
        this.timings = timings;
        this.repository = repository; this.wallets = wallets; this.integration = integration; this.rooms = rooms; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Summary> list(String username) { return repository.list(repository.account(username)); }
    @Transactional(readOnly = true)
    public Snapshot snapshot(long id, String username) {
        Account user = repository.account(username);
        Auction auction = repository.auction(id, false);
        requireAccess(auction, user);
        return snapshot(auction, user);
    }
    @Transactional(readOnly = true)
    public List<Bid> history(long id, String username) { return snapshot(id, username).bids(); }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Snapshot join(long id, String username, String roomCode) {
        Account user = repository.account(username);
        requirePlayer(user);
        Auction auction = repository.auction(id, true);
        if (repository.joined(id, user.id())) {
            if ("PRIVATE".equals(auction.access()) && ("RUNNING".equals(auction.status()) || "UPCOMING".equals(auction.status()))) {
                var access = rooms.validateJoin(user.id(), id, roomCode);
                if (!access.allowed()) throw NormalException.conflict(access.errorCode(), access.errorMessage());
            }
            return snapshot(auction, user);
        }
        Instant now = clock.instant();
        if ((!"RUNNING".equals(auction.status()) && !"UPCOMING".equals(auction.status())) || !now.isBefore(auction.endsAt()))
            throw NormalException.conflict("AUCTION_CLOSED", "Phiên đã kết thúc, không thể tham gia.");
        var access = rooms.authorizeAndRegister(user.id(), id, roomCode);
        if (!access.allowed()) throw NormalException.conflict(access.errorCode(), access.errorMessage());
        var wallet = wallets.lock(wallets.byUser(user.id()).id());
        if (wallet.available() < auction.startingPrice() / 2 + auction.startingPrice() % 2)
            throw NormalException.conflict("PARTICIPATION_BALANCE", "Coin khả dụng chưa đạt 50% giá khởi điểm.");
        return snapshot(auction, user);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BidResponse bid(long id, String username, long amount) {
        Account user = repository.account(username);
        requirePlayer(user);
        Auction auction = repository.auction(id, true);
        // Sample server time after waiting for the lock: bids queued past the deadline are rejected.
        Instant now = clock.instant();
        if (!"RUNNING".equals(auction.status()) || now.isBefore(auction.startsAt()) || !now.isBefore(auction.endsAt()))
            throw NormalException.conflict("AUCTION_CLOSED", "Phiên hiện không nhận giá.");
        if (!repository.joined(id, user.id())) throw NormalException.forbidden("Bạn cần tham gia phiên trước khi đặt giá.");
        Bid previous = leader(repository.bids(id));
        long current = previous == null ? auction.startingPrice() : previous.amount();
        if (amount <= 0 || current > Long.MAX_VALUE - auction.increment() || amount < current + auction.increment())
            throw NormalException.conflict("BID_TOO_LOW", "Mức giá chưa đạt giá hiện tại cộng bước giá tối thiểu.");
        if (amount > Long.MAX_VALUE - auction.increment()) throw NormalException.conflict("COIN_OVERFLOW", "Mức giá vượt giới hạn xử lý.");
        long bidId = repository.bid(id, user.id(), amount, now);
        integration.normalBidAccepted(id, bidId, previous == null ? null : previous.userId(), amount + auction.increment());
        timings.rememberSchedule(id, auction.endsAt());
        var timing = timings.get(id);
        if (!now.isBefore(auction.endsAt().minusSeconds(timing.closingWindowSeconds()))) {
            Instant extended = now.plusSeconds(timing.extensionSeconds());
            if (extended.isAfter(auction.endsAt())) {
                repository.extend(id, extended);
                auction = repository.auction(id, false);
            }
        }
        return new BidResponse(snapshot(auction, user), wallets.byUser(user.id()).response());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void advance(long id) {
        Auction auction = repository.auction(id, true);
        Instant now = clock.instant();
        if (!"RUNNING".equals(auction.status())) return;
        if (!now.isBefore(auction.endsAt())) {
            Bid highest = leader(repository.bids(id));
            boolean sold = highest != null && highest.amount() >= auction.startingPrice();
            if (sold) integration.finishSold(id, highest.userId(), highest.amount());
            else integration.finishUnsold(id);
        }
    }

    private Snapshot snapshot(Auction auction, Account user) {
        List<Bid> bids = repository.bids(auction.id());
        Bid leader = leader(bids);
        return new Snapshot(auction.id(), repository.product(auction.productId()), auction.access(), auction.status(),
                auction.startingPrice(), auction.increment(), auction.startsAt(), auction.endsAt(), auction.finishedAt(),
                leader == null ? auction.startingPrice() : leader.amount(), leader, bids,
                repository.winner(auction.id()), auction.winningPrice(), repository.joined(auction.id(), user.id()), clock.instant(), timings.get(auction.id()), timings.scheduledEnd(auction.id(), auction.endsAt()));
    }
    private void requireAccess(Auction auction, Account user) {
        if ("PRIVATE".equals(auction.access()) && !user.admin() && !repository.joined(auction.id(), user.id()))
            throw NormalException.forbidden("Bạn cần nhập mã phòng và tham gia phiên PRIVATE trước.");
    }
    private void requirePlayer(Account user) { if (user.admin()) throw NormalException.forbidden("Admin không được đặt giá hoặc tham gia với tư cách người chơi."); }
    private Bid leader(List<Bid> bids) {
        return bids.stream().min(Comparator.comparingLong(Bid::amount).reversed()
                .thenComparing(Bid::createdAt).thenComparingLong(Bid::id)).orElse(null);
    }
}
