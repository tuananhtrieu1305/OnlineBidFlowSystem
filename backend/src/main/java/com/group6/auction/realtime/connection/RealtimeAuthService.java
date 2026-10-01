package com.group6.auction.realtime.connection;

import java.net.URI;
import java.util.Optional;

public interface RealtimeAuthService {
    Optional<RealtimePrincipal> authenticateWebSocket(URI uri);
}
