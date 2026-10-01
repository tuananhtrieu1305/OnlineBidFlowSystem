package com.group6.auction.realtime.connection;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RealtimeSessionRegistry {
    private final ConcurrentMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, RealtimePrincipal> principals = new ConcurrentHashMap<>();

    public void register(WebSocketSession session, RealtimePrincipal principal) {
        sessions.put(session.getId(), session);
        principals.put(session.getId(), principal);
    }

    public void unregister(WebSocketSession session) {
        sessions.remove(session.getId());
        principals.remove(session.getId());
    }

    public Optional<RealtimePrincipal> principalFor(WebSocketSession session) {
        return Optional.ofNullable(principals.get(session.getId()));
    }

    public Optional<RealtimePrincipal> principalForSessionId(String sessionId) {
        return Optional.ofNullable(principals.get(sessionId));
    }

    public Optional<WebSocketSession> sessionById(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    public Set<String> sessionIdsForUser(long userId) {
        return principals.entrySet().stream()
                .filter(entry -> entry.getValue().userId() == userId)
                .map(entry -> entry.getKey())
                .collect(Collectors.toUnmodifiableSet());
    }

    public int size() {
        return sessions.size();
    }
}
