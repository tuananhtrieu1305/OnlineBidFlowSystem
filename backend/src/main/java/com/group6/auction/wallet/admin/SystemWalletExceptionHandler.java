package com.group6.auction.wallet.admin;
import com.group6.auction.wallet.service.WalletException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=AdminSystemWalletController.class)
public class SystemWalletExceptionHandler {
 @ExceptionHandler(WalletException.class) ResponseEntity<?> domain(WalletException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.code()));}
 @ExceptionHandler(MethodArgumentTypeMismatchException.class) ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_FILTER"));}
 @ExceptionHandler(Exception.class) ResponseEntity<?> internal(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).error("System wallet query failed",e);return ResponseEntity.internalServerError().body(Map.of("code","INTERNAL_ERROR"));}
}
