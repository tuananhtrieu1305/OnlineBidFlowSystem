package com.group6.auction.account.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.group6.auction.account.repository.UserRepository;
import com.group6.auction.account.service.RegistrationRateLimit;
import com.group6.auction.account.service.RegistrationService;
import com.group6.auction.account.validation.RegistrationInput;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;
import java.util.Map;

@RestController @RequestMapping("/api/auth") @Profile("!probe")
public class AuthController {
    private final RegistrationService registration;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final RegistrationRateLimit limiter;
    public AuthController(RegistrationService registration, UserRepository users, PasswordEncoder encoder, RegistrationRateLimit limiter) {
        this.registration = registration; this.users = users; this.encoder = encoder; this.limiter = limiter;
    }
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody JsonNode body, HttpServletRequest request) {
        if (!limiter.allow(request.getRemoteAddr())) return ResponseEntity.status(429).header("Retry-After", "60")
                .body(error("TOO_MANY_REQUESTS", "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau một phút.", Map.of()));
        var errors = RegistrationInput.errors(body);
        if (!errors.isEmpty()) return ResponseEntity.badRequest().body(error("VALIDATION_ERROR", "Vui lòng kiểm tra thông tin.", errors));
        String username = RegistrationInput.username(body);
        if (users.existsByUsername(username)) return duplicate();
        String hash = encoder.encode(body.get("password").textValue());
        try {
            return ResponseEntity.status(201).body(registration.register(username, hash));
        } catch (DataIntegrityViolationException exception) {
            // register() has already rolled back before this handler inspects the cause.
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof SQLException sql && sql.getErrorCode() == 1062
                        && sql.getMessage().contains("uk_users_username")) return duplicate();
            }
            throw exception;
        }
    }
    private ResponseEntity<?> duplicate() {
        return ResponseEntity.status(409).body(error("USERNAME_TAKEN", "Tên đăng nhập đã được sử dụng.",
                Map.of("username", "Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.")));
    }
    static Map<String, Object> error(String code, String message, Map<String, String> fields) {
        return Map.of("code", code, "message", message, "fieldErrors", fields);
    }
}
