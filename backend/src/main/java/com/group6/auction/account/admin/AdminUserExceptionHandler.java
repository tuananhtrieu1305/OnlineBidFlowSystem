package com.group6.auction.account.admin;
import com.group6.auction.wallet.service.WalletException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=AdminUserController.class)
public class AdminUserExceptionHandler {
 @ExceptionHandler(AdminUserException.class) ResponseEntity<?> domain(AdminUserException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.getMessage()));}
 @ExceptionHandler(WalletException.class) ResponseEntity<?> wallet(WalletException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.getMessage()));}
 @ExceptionHandler(MethodArgumentTypeMismatchException.class) ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT"));}
}
