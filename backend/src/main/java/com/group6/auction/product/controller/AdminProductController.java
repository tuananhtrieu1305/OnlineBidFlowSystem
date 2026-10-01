package com.group6.auction.product.controller;
import com.fasterxml.jackson.databind.JsonNode;
import com.group6.auction.product.service.*;
import com.group6.auction.product.dto.AdminProductResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.*;
import java.net.URI;

@RestController @Profile("!probe") @RequestMapping("/api/admin/products")
public class AdminProductController {
 private final ProductService products;private final ProductImageStorage images;
 public AdminProductController(ProductService products,ProductImageStorage images){this.products=products;this.images=images;}
 @GetMapping public Object list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return products.list(q,page,size);}
 @GetMapping("/{id}") public ResponseEntity<AdminProductResponse> detail(@PathVariable String id){var result=products.detail(id(id));return ResponseEntity.ok().eTag(result.version()).body(result);}
 @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ResponseEntity<AdminProductResponse> create(@RequestPart("data") JsonNode data,@RequestPart(value="image",required=false) MultipartFile image){
  var input=ProductInput.parse(data,false);var staged=images.stage(image);
  try{var result=products.create(input,staged);return ResponseEntity.created(URI.create("/api/admin/products/"+result.id())).eTag(result.version()).body(result);}
  finally{images.discard(staged);}
 }
 @PutMapping(value="/{id}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ResponseEntity<AdminProductResponse> update(@PathVariable String id,@RequestPart("data") JsonNode data,@RequestPart(value="image",required=false) MultipartFile image,@RequestHeader(value="If-Match",required=false) String version){
  long productId=id(id);var input=ProductInput.parse(data,true);
  if(input.imageAction().equals("REPLACE")!=(image!=null))throw new ProductException(400,"INVALID_IMAGE_ACTION");
  var staged=images.stage(image);
  try{var result=products.update(productId,input,version,staged);return ResponseEntity.ok().eTag(result.version()).body(result);}
  finally{images.discard(staged);}
 }
 private long id(String value){try{if(!value.matches("[1-9][0-9]{0,18}"))throw new NumberFormatException();return Long.parseLong(value);}catch(NumberFormatException ex){throw new ProductException(400,"INVALID_ID");}}
}
