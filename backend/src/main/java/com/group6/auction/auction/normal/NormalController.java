package com.group6.auction.auction.normal;

import java.security.Principal;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import com.group6.auction.auction.normal.NormalDtos.*;

@RestController
@RequestMapping("/api/normal")
@Profile("!probe")
@ConditionalOnProperty(name = "app.normal.enabled", havingValue = "true", matchIfMissing = true)
public class NormalController {
    private final NormalService service;
    public NormalController(NormalService service) { this.service = service; }
    @GetMapping("/auctions")
    public List<Summary> list(Principal principal) { return service.list(principal.getName()); }
    @GetMapping("/auctions/{id}")
    public Snapshot snapshot(@PathVariable long id, Principal principal) { return service.snapshot(id, principal.getName()); }
    @GetMapping("/auctions/{id}/bids")
    public List<Bid> history(@PathVariable long id, Principal principal) { return service.history(id, principal.getName()); }
    @PostMapping("/auctions/{id}/join")
    public Snapshot join(@PathVariable long id, @Valid @RequestBody JoinRequest request, Principal principal) {
        return service.join(id, principal.getName(), request.roomCode());
    }
    @PostMapping("/auctions/{id}/bids")
    @ResponseStatus(HttpStatus.CREATED)
    public BidResponse bid(@PathVariable long id, @Valid @RequestBody BidRequest request, Principal principal) {
        return service.bid(id, principal.getName(), request.amount());
    }
}
