package com.group6.auction.realtime.protocol;

import java.util.Map;

public record ErrorPayload(String code, String message, Map<String, Object> details) {
    public static ErrorPayload of(String code, String message) {
        return new ErrorPayload(code, message, Map.of());
    }
}
