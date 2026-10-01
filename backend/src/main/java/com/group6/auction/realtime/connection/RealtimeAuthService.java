package com.group6.auction.realtime.connection;

import java.util.Optional;
import org.springframework.security.core.Authentication;

public interface RealtimeAuthService {
    Optional<RealtimePrincipal> authenticate(Authentication authentication);
}
