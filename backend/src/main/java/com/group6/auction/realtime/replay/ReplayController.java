package com.group6.auction.realtime.replay;

import java.util.Map;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auctions")
public class ReplayController {
    private final ReplayService replayService;

    public ReplayController(ReplayService replayService) {
        this.replayService = replayService;
    }

    @GetMapping("/{auctionId}/replay")
    public ResponseEntity<?> replay(
            @PathVariable long auctionId,
            @RequestHeader(value = "X-Dev-User-Id", required = false) String userIdHeader,
            @RequestHeader(value = "X-Dev-Role", required = false) String roleHeader
    ) {
        var viewer = parseViewer(userIdHeader, roleHeader);
        if (viewer == null) {
            return error(HttpStatus.UNAUTHORIZED, "INVALID_AUTH", "X-Dev-User-Id and X-Dev-Role are required.");
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

    private ReplayViewer parseViewer(String userIdHeader, String roleHeader) {
        if (userIdHeader == null || userIdHeader.isBlank() || roleHeader == null || roleHeader.isBlank()) {
            return null;
        }
        try {
            var userId = Long.parseLong(userIdHeader.trim());
            if (userId <= 0) {
                return null;
            }
            var role = RealtimePrincipal.Role.valueOf(roleHeader.trim().toUpperCase());
            return new ReplayViewer(userId, role);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private ResponseEntity<Map<String, Map<String, String>>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of(
                "error", Map.of("code", code, "message", message)
        ));
    }
}
