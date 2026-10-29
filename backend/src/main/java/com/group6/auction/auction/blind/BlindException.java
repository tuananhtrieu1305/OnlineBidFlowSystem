package com.group6.auction.auction.blind;

public class BlindException extends RuntimeException {
    private final int status;
    public BlindException(int status, String code) { super(code); this.status = status; }
    public int status() { return status; }
    public static BlindException bad(String code) { return new BlindException(400, code); }
    public static BlindException forbidden(String code) { return new BlindException(403, code); }
    public static BlindException conflict(String code) { return new BlindException(409, code); }
}
