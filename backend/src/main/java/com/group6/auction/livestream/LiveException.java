package com.group6.auction.livestream;

public class LiveException extends RuntimeException {
    private final int status;
    private final String code;

    public LiveException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
    public int status() { return status; }
    public String code() { return code; }
    public static LiveException conflict(String message) { return new LiveException(409, "LIVE_CONFLICT", message); }
}
