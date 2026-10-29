package com.group6.auction.auction.normal;

import org.springframework.http.HttpStatus;

public class NormalException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    public NormalException(HttpStatus status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
    public static NormalException conflict(String code, String message) { return new NormalException(HttpStatus.CONFLICT, code, message); }
    public static NormalException forbidden(String message) { return new NormalException(HttpStatus.FORBIDDEN, "FORBIDDEN", message); }
}
