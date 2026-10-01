package com.group6.auction.product;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.product.service.ProductInput;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ProductInputTest {
 private final ObjectMapper json=new ObjectMapper();
 @Test void acceptsCanonicalInput() throws Exception {
  var input=ProductInput.parse(json.readTree("{\"name\":\" Máy ảnh \uD83D\uDCF7 \",\"description\":\"\",\"quantity\":1,\"estimatedPrice\":\"9223372036854775807\"}"),false);
  assertThat(input.name()).isEqualTo("Máy ảnh 📷");
  assertThat(input.description()).isNull();
  assertThat(input.price()).isEqualTo(Long.MAX_VALUE);
 }
 @Test void rejectsInvalidAndUnexpectedFields() throws Exception {
  for(String body:new String[]{"{}","{\"name\":\"x\",\"quantity\":0}","{\"name\":\"x\",\"quantity\":1.5}","{\"name\":\"x\",\"quantity\":\"1\"}","{\"name\":\"x\",\"quantity\":1,\"role\":\"ADMIN\"}","{\"name\":\"x\",\"quantity\":1,\"estimatedPrice\":\"9223372036854775808\"}"})
   assertThatThrownBy(()->ProductInput.parse(json.readTree(body),false)).isInstanceOf(RuntimeException.class);
 }
}
