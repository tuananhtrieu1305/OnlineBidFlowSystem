package com.group6.auction.auction.blind;

import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("!probe")
public class BlindController {
    private final BlindService service;
    public BlindController(BlindService service) { this.service = service; }

    public record CluesInput(List<String> clues) {}
    public record PriceInput(String price) {}
    public record BidInput(String amount) {}
    public record BuyInput(String version) {}
    public record SettingsInput(Integer tradeSeconds, Integer bidSeconds) {}

    @GetMapping("/api/admin/blind/auctions/{id}/settings")
    public Object adminSettings(@PathVariable long id) { return service.adminSettings(id); }
    @PutMapping("/api/admin/blind/auctions/{id}/settings")
    public Object saveSettings(@PathVariable long id, @RequestBody SettingsInput input) {
        return service.saveSettings(id,input==null?null:input.tradeSeconds(),input==null?null:input.bidSeconds());
    }
    @PostMapping("/api/admin/blind/auctions/{id}/start")
    public Object startNow(@PathVariable long id) { return service.startNow(id); }

    @GetMapping("/api/admin/blind/auctions/{id}/clues")
    public Object adminClues(@PathVariable long id) { return service.adminClues(id); }
    @PutMapping("/api/admin/blind/auctions/{id}/clues")
    public Object saveClues(@PathVariable long id, @RequestBody CluesInput input) { return service.saveClues(id, input == null ? null : input.clues()); }

    @GetMapping("/api/blind/auctions/{id}")
    public Object state(@PathVariable long id, Authentication auth) { return service.state(id, auth.getName()); }
    @PutMapping("/api/blind/auctions/{id}/listings/{clueId}")
    public Object list(@PathVariable long id, @PathVariable long clueId, @RequestBody PriceInput input, Authentication auth) {
        return service.list(id, clueId, auth.getName(), input == null ? null : input.price());
    }
    @DeleteMapping("/api/blind/auctions/{id}/listings/{clueId}")
    public Object cancel(@PathVariable long id, @PathVariable long clueId, Authentication auth) {
        return service.cancel(id, clueId, auth.getName());
    }
    @PostMapping("/api/blind/auctions/{id}/listings/{listingId}/buy")
    public Object buy(@PathVariable long id, @PathVariable long listingId, @RequestBody BuyInput input, Authentication auth) {
        return service.buy(id, listingId, auth.getName(), input == null ? null : input.version());
    }
    @PostMapping("/api/blind/auctions/{id}/bids")
    public Object bid(@PathVariable long id, @RequestBody BidInput input, Authentication auth) {
        return service.bid(id, auth.getName(), input == null ? null : input.amount());
    }

    @RestControllerAdvice(assignableTypes = BlindController.class)
    public static class Errors {
        @ExceptionHandler(BlindException.class)
        ResponseEntity<?> domain(BlindException error) { return ResponseEntity.status(error.status()).body(Map.of("code", error.getMessage())); }
        @ExceptionHandler(com.group6.auction.wallet.service.WalletException.class)
        ResponseEntity<?> wallet(com.group6.auction.wallet.service.WalletException error) { return ResponseEntity.status(error.status()).body(Map.of("code", error.code())); }
        @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class, org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
        ResponseEntity<?> input() { return ResponseEntity.badRequest().body(Map.of("code", "INVALID_INPUT")); }
    }
}
