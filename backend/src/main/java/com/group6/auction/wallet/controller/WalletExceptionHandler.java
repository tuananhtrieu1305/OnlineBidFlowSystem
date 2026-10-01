package com.group6.auction.wallet.controller;
import com.group6.auction.wallet.service.WalletException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=WalletController.class)
public class WalletExceptionHandler {
 @ExceptionHandler(WalletException.class) ResponseEntity<?> wallet(WalletException ex){return ResponseEntity.status(ex.status()).body(Map.of("code",ex.code()));}
 @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class})
 ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT"));}
 @ExceptionHandler(Exception.class) ResponseEntity<?> internal(){return ResponseEntity.internalServerError().body(Map.of("code","INTERNAL_ERROR"));}
}
