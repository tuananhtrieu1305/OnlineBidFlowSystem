package com.group6.auction.account.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class RegistrationExceptionHandler {
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<?> invalidJson() {
        return ResponseEntity.badRequest().body(AuthController.error("VALIDATION_ERROR", "Dữ liệu đăng ký không hợp lệ.", Map.of()));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unavailable() {
        return ResponseEntity.internalServerError().body(AuthController.error("INTERNAL_ERROR", "Chưa thể tạo tài khoản. Vui lòng thử lại sau.", Map.of()));
    }
}
