package com.group6.auction.realtime.connection;

import java.util.Optional;
import com.group6.auction.account.repository.UserRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class SessionRealtimeAuthService implements RealtimeAuthService {
    private final ObjectProvider<UserRepository> users;
    public SessionRealtimeAuthService(ObjectProvider<UserRepository> users) { this.users = users; }

    @Override
    public Optional<RealtimePrincipal> authenticate(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return Optional.empty();
        var repository = users.getIfAvailable();
        if (repository == null) return Optional.empty();
        return repository.findByUsername(auth.getName()).map(user ->
            new RealtimePrincipal(user.getId(), user.getUsername(), RealtimePrincipal.Role.valueOf(user.getRole())));
    }
}
