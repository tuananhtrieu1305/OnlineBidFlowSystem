package com.group6.auction.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.group6.auction.auction.configuration.AuctionInput;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class BlindSetupInputTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private ObjectNode input(int capacity, int clueCount) {
        var node = mapper.createObjectNode();
        node.put("auctionType", "BLIND").put("accessType", "PUBLIC")
            .put("startingPrice", "100").putNull("minBidIncrement");
        node.put("maxParticipants", capacity).put("startTime", "2030-01-01T08:00:00Z");
        var setup = node.putObject("blindSetup");
        var clues = setup.putArray("clues");
        for (int i = 0; i < clueCount; i++) clues.add("Clue " + i);
        setup.put("tradeSeconds", 300).put("bidSeconds", 100);
        return node;
    }

    @Test void acceptsMatchingCluesForAllowedCapacity() {
        for (int capacity : new int[]{3, 4, 6, 30}) {
            var parsed = AuctionInput.parse(input(capacity, capacity), false);
            assertThat(parsed.capacity()).isEqualTo(capacity);
            assertThat(parsed.blindSetup().clues()).hasSize(capacity);
        }
    }

    @Test void rejectsWrongCapacityOrClues() {
        for (int capacity : new int[]{2, 31})
            assertThatThrownBy(() -> AuctionInput.parse(input(capacity, capacity), false)).hasMessage("INVALID_AUCTION_CONFIGURATION");
        assertThatThrownBy(() -> AuctionInput.parse(input(6, 4), false)).hasMessage("INVALID_AUCTION_CONFIGURATION");
        var duplicate = input(3, 3);
        ((com.fasterxml.jackson.databind.node.ArrayNode)duplicate.get("blindSetup").get("clues")).set(2, mapper.getNodeFactory().textNode("Clue 0"));
        assertThatThrownBy(() -> AuctionInput.parse(duplicate, false)).hasMessage("INVALID_AUCTION_CONFIGURATION");
    }
}
