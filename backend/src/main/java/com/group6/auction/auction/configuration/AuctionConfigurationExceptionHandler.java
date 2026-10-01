package com.group6.auction.auction.configuration;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=AdminAuctionController.class)
public class AuctionConfigurationExceptionHandler {
 @ExceptionHandler(AuctionConfigurationException.class) ResponseEntity<?> domain(AuctionConfigurationException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.getMessage()));}
 @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class}) ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT"));}
 @ExceptionHandler(Exception.class) ResponseEntity<?> internal(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).error("Auction configuration failed",e);return ResponseEntity.internalServerError().body(Map.of("code","INTERNAL_ERROR"));}
}
