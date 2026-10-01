package com.group6.auction.realtime.chat;

public record ChatSendResult(boolean allowed, String errorCode, String errorMessage, ChatMessageSnapshot message) {
    public static ChatSendResult success(ChatMessageSnapshot message) {
        return new ChatSendResult(true, null, null, message);
    }

    public static ChatSendResult denied(String errorCode, String errorMessage) {
        return new ChatSendResult(false, errorCode, errorMessage, null);
    }
}
