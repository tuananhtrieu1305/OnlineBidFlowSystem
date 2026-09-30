package com.group6.auction.account.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.group6.auction.account.dto.UserResponse;
import com.group6.auction.account.repository.UserRepository;
import com.group6.auction.account.service.RegistrationRateLimit;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController @Profile("!probe")
public class LoginController {
    private final AuthenticationManager manager;
    private final SessionAuthenticationStrategy strategy;
    private final HttpSessionSecurityContextRepository contexts;
    private final UserRepository users;
    private final RegistrationRateLimit byIp;
    private final RegistrationRateLimit byAccount;

    public LoginController(AuthenticationManager manager, SessionAuthenticationStrategy strategy,
        HttpSessionSecurityContextRepository contexts, UserRepository users,
        @Value("${app.login.attempts-per-minute:10}") int attempts) {
        this.manager = manager; this.strategy = strategy; this.contexts = contexts; this.users = users;
        byIp = new RegistrationRateLimit(attempts);
        byAccount = new RegistrationRateLimit(attempts);
    }
    @GetMapping("/api/auth/csrf")
    public Map<String, String> csrf(CsrfToken token) { return Map.of("token", token.getToken()); }

    @PostMapping("/api/auth/login")
    public ResponseEntity<?> login(@RequestBody JsonNode body, HttpServletRequest request, HttpServletResponse response) {
        if (!byIp.allow(request.getRemoteAddr())) return limited();
        if (body == null || !body.isObject() || body.size() != 2
            || !body.path("username").isTextual() || !body.path("password").isTextual()) return invalid();
        String username = body.get("username").asText().trim().toLowerCase(Locale.ROOT);
        String password = body.get("password").asText();
        if (!username.matches("[a-z0-9._-]{3,50}") || password.isEmpty()
            || password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf('\0') >= 0) return invalid();
        // Login accepts existing passwords; the stronger registration minimum is not reapplied.
        if (!byAccount.allow(username)) return limited();
        try {
            Authentication auth = manager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, password));
            strategy.onAuthentication(auth, request, response);
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
            return ResponseEntity.ok(identity(auth));
        } catch (AuthenticationException ex) {
            return ResponseEntity.status(401).body(Map.of("code", "INVALID_CREDENTIALS"));
        }
    }
    @GetMapping({"/api/auth/me", "/api/admin/session"})
    public UserResponse me(Authentication auth) { return identity(auth); }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response, Authentication auth) {
        new SecurityContextLogoutHandler().logout(request, response, auth);
        response.addHeader("Set-Cookie", "OBFSESSION=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None");
        return ResponseEntity.noContent().build();
    }
    private UserResponse identity(Authentication auth) {
        var user = users.findByUsername(auth.getName()).orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        return new UserResponse(user.getId(), user.getUsername(), user.getRole());
    }
    private ResponseEntity<?> invalid() { return ResponseEntity.badRequest().body(Map.of("code", "VALIDATION_ERROR")); }
    private ResponseEntity<?> limited() {
        return ResponseEntity.status(429).header("Retry-After", "60").body(Map.of("code", "TOO_MANY_REQUESTS"));
    }
}
