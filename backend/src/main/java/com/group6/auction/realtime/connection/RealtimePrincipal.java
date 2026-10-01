package com.group6.auction.realtime.connection;

public record RealtimePrincipal(long userId, String username, Role role) {
    public enum Role {
        USER,
        ADMIN
    }
}
