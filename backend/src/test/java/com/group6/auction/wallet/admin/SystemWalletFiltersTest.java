package com.group6.auction.wallet.admin;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class SystemWalletFiltersTest {
 @Test void normalizesUtcAndRejectsBadInput(){
  var f=SystemWalletFilters.parse("12","PAYMENT","2030-01-01T07:00:00+07:00","2030-01-02T00:00:00Z",20);
  assertThat(f.from().toString()).isEqualTo("2030-01-01T00:00");
  assertThatThrownBy(()->SystemWalletFilters.parse("0","",null,null,20)).hasMessage("INVALID_FILTER");
  assertThatThrownBy(()->SystemWalletFilters.parse(null,"BAD",null,null,20)).hasMessage("INVALID_FILTER");
  assertThatThrownBy(()->SystemWalletFilters.parse(null,"","2030-01-01",null,20)).hasMessage("INVALID_FILTER");
  assertThatThrownBy(()->SystemWalletFilters.parse(null,"","2030-01-02T00:00:00Z","2030-01-01T00:00:00Z",20)).hasMessage("INVALID_FILTER");
 }
}
