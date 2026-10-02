package com.group6.auction.wallet.admin;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("!probe") @RequestMapping("/api/admin/system-wallet")
public class AdminSystemWalletController {
 private final SystemWalletQueryService service;
 public AdminSystemWalletController(SystemWalletQueryService service){this.service=service;}
 @GetMapping public Object summary(){return service.summary();}
 @GetMapping("/transactions") public Object history(@RequestParam(required=false) String auctionId,@RequestParam(required=false) String type,@RequestParam(required=false) String from,@RequestParam(required=false) String to,@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) String cursor){return service.history(SystemWalletFilters.parse(auctionId,type,from,to,limit),cursor);}
}
