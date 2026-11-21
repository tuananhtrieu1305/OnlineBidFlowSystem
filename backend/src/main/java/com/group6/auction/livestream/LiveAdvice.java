package com.group6.auction.livestream;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.Map;
@RestControllerAdvice(basePackageClasses=LiveController.class)
public class LiveAdvice {
    @ExceptionHandler(LiveException.class) public ResponseEntity<?> live(LiveException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.code(),"message",e.getMessage()));}
    @ExceptionHandler(com.group6.auction.wallet.service.WalletException.class) public ResponseEntity<?> wallet(com.group6.auction.wallet.service.WalletException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.code(),"message",e.code().equals("INSUFFICIENT_COIN")?"Ví không đủ Coin khả dụng để đặt giá.":e.code()));}
    @ExceptionHandler(com.group6.auction.auction.configuration.AuctionConfigurationException.class) public ResponseEntity<?> inventory(com.group6.auction.auction.configuration.AuctionConfigurationException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.getMessage(),"message","Sản phẩm đã được bán hoặc giữ cho phiên khác. Hãy chọn lại hàng."));}
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,org.springframework.http.converter.HttpMessageNotReadableException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) public ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","Thông tin gửi lên không hợp lệ."));}
    @ExceptionHandler(org.springframework.dao.DuplicateKeyException.class) public ResponseEntity<?> duplicate(){return ResponseEntity.status(409).body(Map.of("code","REQUEST_CONFLICT","message","Yêu cầu đã được xử lý. Hãy tải lại phiên."));}
}
