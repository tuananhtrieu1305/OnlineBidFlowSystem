package com.group6.auction.auction.configuration;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.net.URI;
@RestController @Profile("!probe") @RequestMapping("/api/admin/auctions")
public class AdminAuctionController {
 private final AuctionConfigurationService service;
 public AdminAuctionController(AuctionConfigurationService service){this.service=service;}
 @GetMapping public Object list(@RequestParam(defaultValue="") String q,@RequestParam(required=false) String status,@RequestParam(required=false) String auctionType,@RequestParam(required=false) String accessType,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(q,status,auctionType,accessType,page,size);}
 @GetMapping("/{id}") public ResponseEntity<?> detail(@PathVariable String id){var v=service.detail(id(id));return ResponseEntity.ok().eTag((String)v.get("version")).body(v);}
 @PostMapping public ResponseEntity<?> create(Authentication auth,@RequestBody JsonNode body){var v=service.create(auth.getName(),AuctionInput.parse(body,true));return ResponseEntity.created(URI.create("/api/admin/auctions/"+v.get("id"))).eTag((String)v.get("version")).body(v);}
 @PutMapping("/{id}") public ResponseEntity<?> update(@PathVariable String id,@RequestBody JsonNode body,@RequestHeader(value="If-Match",required=false) String version){var v=service.update(id(id),AuctionInput.parse(body,false),version);return ResponseEntity.ok().eTag((String)v.get("version")).body(v);}
 private long id(String value){try{if(!value.matches("[1-9][0-9]{0,18}"))throw new NumberFormatException();return Long.parseLong(value);}catch(NumberFormatException ex){throw new AuctionConfigurationException(400,"INVALID_ID");}}
}
