package com.group6.auction.product.statistics;

import com.group6.auction.product.service.ProductException;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("!probe")
@RequestMapping("/api/admin/products/{productId}/statistics")
public class ProductStatisticsController {
    private final ProductStatisticsService statistics;

    public ProductStatisticsController(ProductStatisticsService statistics) { this.statistics = statistics; }

    @GetMapping
    public ProductStatisticsService.Statistics get(@PathVariable String productId,
                                                    @RequestParam(defaultValue = "0") int page) {
        if (!productId.matches("[1-9][0-9]{0,18}")) throw new ProductException(400, "INVALID_ID");
        try { return statistics.get(Long.parseLong(productId), page); }
        catch (NumberFormatException exception) { throw new ProductException(400, "INVALID_ID"); }
    }

    @ExceptionHandler(ProductException.class)
    public ResponseEntity<Map<String, String>> error(ProductException exception) {
        return ResponseEntity.status(exception.status()).body(Map.of("code", exception.getMessage()));
    }
}
