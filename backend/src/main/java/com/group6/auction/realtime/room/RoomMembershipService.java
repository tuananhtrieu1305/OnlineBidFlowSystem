package com.group6.auction.realtime.room;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.springframework.stereotype.Service;

@Service
public class RoomMembershipService {
    private final RoomAccessService roomAccessService;
    private final RoomDataGateway roomDataGateway;
    private final ConcurrentMap<String, Set<Long>> auctionsBySession = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, Set<String>> sessionsByAuction = new ConcurrentHashMap<>();

    public RoomMembershipService(RoomAccessService roomAccessService, RoomDataGateway roomDataGateway) {
        this.roomAccessService = roomAccessService;
        this.roomDataGateway = roomDataGateway;
    }

    public RoomAccessResult join(String sessionId, RealtimePrincipal principal, long auctionId, String roomCode) {
        var access = roomAccessService.validateJoin(principal.userId(), auctionId, roomCode);
        if (!access.allowed()) {
            return access;
        }

        var sessionAuctions = auctionsBySession.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet());
        if (sessionAuctions.contains(auctionId)) {
            return RoomAccessResult.unchangedSuccess();
        }

        roomDataGateway.ensureParticipant(auctionId, principal.userId());
        sessionAuctions.add(auctionId);
        sessionsByAuction.computeIfAbsent(auctionId, ignored -> ConcurrentHashMap.newKeySet()).add(sessionId);
        return RoomAccessResult.success();
    }

    public RoomAccessResult leave(String sessionId, RealtimePrincipal principal, long auctionId) {
        var sessionAuctions = auctionsBySession.get(sessionId);
        if (sessionAuctions == null || !sessionAuctions.remove(auctionId)) {
            return RoomAccessResult.denied("NOT_IN_ROOM", "Session is not in this auction room.");
        }

        removeSessionFromAuction(sessionId, auctionId);
        return RoomAccessResult.success();
    }

    public Set<Long> disconnect(String sessionId) {
        var auctionIds = auctionsBySession.remove(sessionId);
        if (auctionIds == null || auctionIds.isEmpty()) {
            return Set.of();
        }

        for (Long auctionId : auctionIds) {
            removeSessionFromAuction(sessionId, auctionId);
        }
        return Set.copyOf(auctionIds);
    }

    public Set<Long> auctionIdsForSession(String sessionId) {
        var auctionIds = auctionsBySession.get(sessionId);
        if (auctionIds == null) {
            return Set.of();
        }
        return Collections.unmodifiableSet(new HashSet<>(auctionIds));
    }

    public Set<String> sessionIdsForAuction(long auctionId) {
        var sessionIds = sessionsByAuction.get(auctionId);
        if (sessionIds == null) {
            return Set.of();
        }
        return Collections.unmodifiableSet(new HashSet<>(sessionIds));
    }

    private void removeSessionFromAuction(String sessionId, long auctionId) {
        var sessionIds = sessionsByAuction.get(auctionId);
        if (sessionIds == null) {
            return;
        }
        sessionIds.remove(sessionId);
        if (sessionIds.isEmpty()) {
            sessionsByAuction.remove(auctionId, sessionIds);
        }
    }
}
