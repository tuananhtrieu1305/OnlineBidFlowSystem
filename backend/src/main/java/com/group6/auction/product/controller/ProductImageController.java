package com.group6.auction.product.controller;
import com.group6.auction.product.service.ProductImageStorage;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.core.io.Resource;
@RestController @Profile("!probe")
public class ProductImageController {
 private final ProductImageStorage images;
 public ProductImageController(ProductImageStorage images){this.images=images;}
 @GetMapping("/api/product-images/{name}")
 public ResponseEntity<Resource> image(@PathVariable String name){
  var resource=images.read(name);
  return ResponseEntity.ok().contentType(name.endsWith(".png")?MediaType.IMAGE_PNG:MediaType.IMAGE_JPEG)
   .header("X-Content-Type-Options","nosniff").cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30))).body(resource);
 }
}
