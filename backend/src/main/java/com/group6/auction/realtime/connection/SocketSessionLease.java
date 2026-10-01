package com.group6.auction.realtime.connection;

import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.socket.WebSocketSession;

/** The HTTP session remains authoritative for the whole lifetime of the socket. */
public record SocketSessionLease(HttpSession session, String sessionId, String username) {
    public static final String ATTRIBUTE = "httpSessionLease";
    public boolean valid() {
        try {
            if (!sessionId.equals(session.getId())) return false;
            int timeout = session.getMaxInactiveInterval();
            if (timeout > 0 && System.currentTimeMillis() - session.getLastAccessedTime() >= timeout * 1000L) return false;
            Object stored = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
            if (!(stored instanceof SecurityContext context)) return false;
            var auth = context.getAuthentication();
            return auth != null && auth.isAuthenticated() && username.equals(auth.getName());
        } catch (IllegalStateException expired) { return false; }
    }
    public static boolean valid(WebSocketSession socket) {
        return socket.getAttributes().get(ATTRIBUTE) instanceof SocketSessionLease lease && lease.valid();
    }
}
