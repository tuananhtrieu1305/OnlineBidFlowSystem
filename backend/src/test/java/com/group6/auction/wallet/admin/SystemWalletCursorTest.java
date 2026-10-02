package com.group6.auction.wallet.admin;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class SystemWalletCursorTest {
 @Test void roundTripPreservesMicrosecondsAndRejectsWrongWallet(){
  var f=SystemWalletFilters.parse(null,"",null,null,20);var cursor=new SystemWalletCursor(LocalDateTime.parse("2030-01-01T00:00:00.123456"),99);
  assertThat(SystemWalletCursor.decode(cursor.encode(8,f),8,f)).isEqualTo(cursor);
  assertThatThrownBy(()->SystemWalletCursor.decode(cursor.encode(8,f),9,f)).hasMessage("INVALID_CURSOR");
  assertThatThrownBy(()->SystemWalletCursor.decode("x".repeat(513),8,f)).hasMessage("INVALID_CURSOR");
  assertThat(SystemWalletCursor.decode(null,8,f)).isNull();
 }
}
