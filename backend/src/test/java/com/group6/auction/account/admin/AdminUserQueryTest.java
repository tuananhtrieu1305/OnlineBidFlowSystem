package com.group6.auction.account.admin;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class AdminUserQueryTest {
 @Test void rejectsInvalidPaginationAndRolesBeforeQuery(){
  var service=new AdminUserQueryService(null,null);
  assertThatThrownBy(()->service.list("","ROOT",0,20)).hasMessage("INVALID_FILTER");
  assertThatThrownBy(()->service.list("","",Integer.MAX_VALUE,100)).hasMessage("INVALID_FILTER");
  assertThatThrownBy(()->service.list("x".repeat(51),"",0,20)).hasMessage("INVALID_FILTER");
 }
}
