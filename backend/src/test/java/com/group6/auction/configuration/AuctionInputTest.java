package com.group6.auction.configuration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.auction.configuration.AuctionInput;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class AuctionInputTest {
 @Test void validatesIndependentTypeAndAccessAndUtc() throws Exception {
  var json=new ObjectMapper();
  var node=json.readTree("{\"productId\":\"1\",\"productVersion\":\"v1\",\"auctionType\":\"BLIND\",\"accessType\":\"PRIVATE\",\"startingPrice\":\"100\",\"minBidIncrement\":null,\"maxParticipants\":2,\"startTime\":\"2026-11-01T10:00:00+07:00\",\"endTime\":\"2026-11-01T11:00:00+07:00\"}");
  var input=AuctionInput.parse(node,true);
  assertThat(input.start().toString()).isEqualTo("2026-11-01T03:00");
  assertThat(input.increment()).isNull();
  ((com.fasterxml.jackson.databind.node.ObjectNode)node).put("minBidIncrement","10");
  assertThatThrownBy(()->AuctionInput.parse(node,true)).isInstanceOf(RuntimeException.class);
 }
}
