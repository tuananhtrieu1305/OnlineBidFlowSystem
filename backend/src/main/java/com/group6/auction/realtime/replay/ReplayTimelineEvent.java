package com.group6.auction.realtime.replay;

public record ReplayTimelineEvent(String type, String at, Object payload) {
}
