package com.group6.auction.realtime.connection;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

@Service
public class MockRealtimeAuthService implements RealtimeAuthService {
    @Override
    public Optional<RealtimePrincipal> authenticateWebSocket(URI uri) {
        if (uri == null || uri.getRawQuery() == null || uri.getRawQuery().isBlank()) {
            return Optional.empty();
        }
        var params = parseQuery(uri.getRawQuery());
        try {
            var userId = Long.parseLong(params.getOrDefault("userId", ""));
            var role = RealtimePrincipal.Role.valueOf(params.getOrDefault("role", ""));
            if (userId <= 0) {
                return Optional.empty();
            }
            return Optional.of(new RealtimePrincipal(userId, "dev-user-" + userId, role));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private Map<String, String> parseQuery(String rawQuery) {
        return Arrays.stream(rawQuery.split("&"))
                .map(part -> part.split("=", 2))
                .filter(parts -> parts.length == 2)
                .collect(Collectors.toMap(
                        parts -> decode(parts[0]),
                        parts -> decode(parts[1]),
                        (first, second) -> second
                ));
    }

    private String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
