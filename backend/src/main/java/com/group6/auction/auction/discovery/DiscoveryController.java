package com.group6.auction.auction.discovery;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController @Profile("!probe") @RequestMapping("/api/discovery/auctions")
public class DiscoveryController {
 private final DiscoveryService service;
 public DiscoveryController(DiscoveryService service){this.service=service;}
 @GetMapping public Object list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="") String status,
  @RequestParam(defaultValue="") String auctionType,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size){return service.list(q,status,auctionType,page,size);}
 @GetMapping("/{id}") public Object detail(@PathVariable String id){
  try{if(!id.matches("[1-9][0-9]{0,18}"))throw new NumberFormatException();return service.detail(Long.parseLong(id));}
  catch(NumberFormatException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST);}
 }
}
