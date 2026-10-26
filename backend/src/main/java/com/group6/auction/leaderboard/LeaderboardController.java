package com.group6.auction.leaderboard;

import java.security.Principal;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("!probe")
@RequestMapping("/api/leaderboard")
public class LeaderboardController {
    private final LeaderboardService leaderboard;

    public LeaderboardController(LeaderboardService leaderboard) { this.leaderboard = leaderboard; }

    @GetMapping
    public LeaderboardService.Board board(@RequestParam(defaultValue = "ALL") String type,
                                           @RequestParam(defaultValue = "ALL_TIME") String period) {
        return leaderboard.board(type, period);
    }

    @GetMapping("/me")
    public LeaderboardService.Mine mine(@RequestParam(defaultValue = "ALL") String type,
                                         @RequestParam(defaultValue = "ALL_TIME") String period,
                                         Principal principal) {
        return leaderboard.mine(type, period, principal == null ? null : principal.getName());
    }

    @ExceptionHandler(LeaderboardException.class)
    public ResponseEntity<Map<String,String>> error(LeaderboardException exception) {
        return ResponseEntity.status(exception.status()).body(Map.of("code", exception.getMessage()));
    }
}
