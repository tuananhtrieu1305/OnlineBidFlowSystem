package com.group6.auction.leaderboard;

public class LeaderboardException extends RuntimeException {
    private final int status;

    public LeaderboardException(int status, String code) {
        super(code);
        this.status = status;
    }

    public int status() { return status; }
}
