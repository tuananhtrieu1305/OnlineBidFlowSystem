package com.group6.auction.wallet.controller;
import com.fasterxml.jackson.databind.JsonNode;
import com.group6.auction.wallet.service.*;
import com.group6.auction.account.service.RegistrationRateLimit;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import java.util.Map;

@RestController @RequestMapping("/api/wallet") @Profile("!probe")
public class WalletController {
 private final WalletQueryService wallets;
 private final RegistrationRateLimit limiter;
 public WalletController(WalletQueryService wallets,
  @org.springframework.beans.factory.annotation.Value("${app.wallet.deposits-per-minute:10}") int attempts){
  this.wallets=wallets;this.limiter=new RegistrationRateLimit(attempts);
 }
 @GetMapping public Object balance(Authentication auth){return wallets.balance(auth.getName());}
 @GetMapping("/transactions") public Object history(Authentication auth,@RequestParam(required=false) String type,
  @RequestParam(defaultValue="20") int limit,@RequestParam(required=false) String cursor){return wallets.history(auth.getName(),type,limit,cursor);}
 @PostMapping("/deposits") public ResponseEntity<?> deposit(Authentication auth,@RequestBody JsonNode body){
  if(body==null||!body.isObject()||body.size()!=1||!body.path("amount").isTextual())throw new WalletException(400,"INVALID_AMOUNT");
  String value=body.get("amount").asText();
  if(!value.matches("[1-9][0-9]{0,18}"))throw new WalletException(400,"INVALID_AMOUNT");
  long amount;try{amount=Long.parseLong(value);}catch(NumberFormatException ex){throw new WalletException(400,"INVALID_AMOUNT");}
  if(!limiter.allow(auth.getName()))return ResponseEntity.status(429).header("Retry-After","60").body(Map.of("code","TOO_MANY_REQUESTS"));
  return ResponseEntity.status(201).body(wallets.deposit(auth.getName(),amount));
 }
}
