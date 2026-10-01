package com.group6.auction.realtime.replay;

import java.util.Map;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.security.core.Authentication;
import com.group6.auction.realtime.connection.RealtimeAuthService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auctions")
public class ReplayController {
    private final ReplayService replayService;

    private final RealtimeAuthService authService;
    public ReplayController(ReplayService replayService, RealtimeAuthService authService) {
        this.authService = authService;
        this.replayService = replayService;
    }

    @GetMapping("/{auctionId}/replay")
    public ResponseEntity<?> replay(
            @PathVariable long auctionId,
            Authentication authentication
    ) {
        var viewer = authService.authenticate(authentication).map(p -> new ReplayViewer(p.userId(), p.role())).orElse(null);
        if (viewer == null) {
            return error(HttpStatus.UNAUTHORIZED, "INVALID_AUTH", "Authentication is required.");
        }
        if (auctionId <= 0) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "auctionId must be positive.");
        }

        try {
            return ResponseEntity.ok(replayService.buildReplay(auctionId, viewer));
        } catch (ReplayException ex) {
            return error(ex.status(), ex.code(), ex.getMessage());
        }
    }

    private ResponseEntity<Map<String, Map<String, String>>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of(
                "error", Map.of("code", code, "message", message)
        ));
    }
}
