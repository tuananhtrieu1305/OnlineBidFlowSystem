package com.group6.auction.realtime.room;

public record RoomAccessResult(boolean allowed, String errorCode, String errorMessage, boolean changed) {
    public static RoomAccessResult success() {
        return new RoomAccessResult(true, null, null, true);
    }

    public static RoomAccessResult unchangedSuccess() {
        return new RoomAccessResult(true, null, null, false);
    }

    public static RoomAccessResult denied(String errorCode, String errorMessage) {
        return new RoomAccessResult(false, errorCode, errorMessage, false);
    }
}
