package com.group6.auction.realtime.replay;

import org.springframework.http.HttpStatus;

public class ReplayException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    private ReplayException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ReplayException notFound(String code, String message) {
        return new ReplayException(HttpStatus.NOT_FOUND, code, message);
    }

    public static ReplayException conflict(String code, String message) {
        return new ReplayException(HttpStatus.CONFLICT, code, message);
    }

    public static ReplayException forbidden(String code, String message) {
        return new ReplayException(HttpStatus.FORBIDDEN, code, message);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
