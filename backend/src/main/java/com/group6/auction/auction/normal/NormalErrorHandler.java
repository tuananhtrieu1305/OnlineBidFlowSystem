package com.group6.auction.auction.normal;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.ConcurrencyFailureException;
import com.group6.auction.wallet.service.WalletException;

@RestControllerAdvice(basePackageClasses = NormalController.class)
public class NormalErrorHandler {
    @ExceptionHandler(WalletException.class)
    ResponseEntity<?> wallet(WalletException error) {
        String message = switch (error.code()) {
            case "INSUFFICIENT_COIN" -> "Coin khả dụng không đủ cho mức giá này.";
            case "WALLET_LEDGER_INCONSISTENT" -> "Lịch sử khóa Coin chưa khớp số dư ví. Cần đối soát dữ liệu trước khi đặt giá.";
            default -> "Không thể xử lý ví: " + error.code();
        };
        return ResponseEntity.status(error.status()).body(Map.of("code", error.code(), "message", message));
    }
    @ExceptionHandler(NormalException.class)
    ResponseEntity<?> normal(NormalException error) {
        return ResponseEntity.status(error.status()).body(Map.of("code", error.code(), "message", error.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Dữ liệu gửi lên không hợp lệ. Coin phải là số nguyên dương."));
    }
    @ExceptionHandler(ConcurrencyFailureException.class)
    ResponseEntity<?> concurrent(ConcurrencyFailureException error) {
        return ResponseEntity.status(409).body(Map.of("code", "CONCURRENT_UPDATE", "message", "Phiên vừa được cập nhật. Tải lại dữ liệu trước khi đặt giá."));
    }
}
