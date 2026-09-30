package com.group6.auction.account.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice(assignableTypes = LoginController.class)
public class LoginExceptionHandler {
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<?> malformed() { return ResponseEntity.badRequest().body(Map.of("code", "VALIDATION_ERROR")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unavailable() { return ResponseEntity.internalServerError().body(Map.of("code", "INTERNAL_ERROR")); }
}
