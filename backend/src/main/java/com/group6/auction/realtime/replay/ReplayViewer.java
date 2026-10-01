package com.group6.auction.realtime.replay;

import com.group6.auction.realtime.connection.RealtimePrincipal;

public record ReplayViewer(long userId, RealtimePrincipal.Role role) {
    public boolean admin() {
        return role == RealtimePrincipal.Role.ADMIN;
    }
}
