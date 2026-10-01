package com.group6.auction.product.controller;
import com.group6.auction.product.service.ProductException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import java.util.Map;
@RestControllerAdvice(assignableTypes={AdminProductController.class,ProductImageController.class})
public class ProductExceptionHandler {
 @ExceptionHandler(ProductException.class) ResponseEntity<?> domain(ProductException e){return error(e.status(),e.getMessage());}
 @ExceptionHandler({HttpMessageNotReadableException.class,MissingServletRequestPartException.class,MethodArgumentTypeMismatchException.class}) ResponseEntity<?> invalid(){return error(400,"INVALID_PRODUCT");}
 @ExceptionHandler(MaxUploadSizeExceededException.class) ResponseEntity<?> size(){return error(413,"IMAGE_TOO_LARGE");}
 @ExceptionHandler(HttpMediaTypeNotSupportedException.class) ResponseEntity<?> type(){return error(415,"UNSUPPORTED_TYPE");}
 @ExceptionHandler(Exception.class) ResponseEntity<?> internal(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).error("Product request failed",e);return error(500,"INTERNAL_ERROR");}
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(Map.of("code",code));}
}
