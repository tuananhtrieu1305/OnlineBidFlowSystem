package com.group6.auction.realtime.protocol;

import com.fasterxml.jackson.databind.JsonNode;

public record ClientMessage(String type, String requestId, JsonNode payload) {
}
