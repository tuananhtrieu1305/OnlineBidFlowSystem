package com.group6.auction.product.service;
import com.group6.auction.product.entity.Product;
import com.group6.auction.product.dto.AdminProductResponse;
import com.group6.auction.product.repository.ProductRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import java.util.*;

@Service @Profile("!probe")
public class ProductService {
 private final ProductRepository products;
 private final ProductImageStorage images;
 public ProductService(ProductRepository products,ProductImageStorage images){this.products=products;this.images=images;}
 public record ProductPage(List<AdminProductResponse> items,int page,int size,String totalElements,int totalPages){}
 @Transactional(readOnly=true)
 public ProductPage list(String query,int page,int size){
  String q=query==null?"":query.strip();
  if(q.codePointCount(0,q.length())>255||page<0||size<1||size>100||(long)page*size>Integer.MAX_VALUE)throw new ProductException(400,"INVALID_FILTER");
  long exact=-1;try{if(q.matches("[1-9][0-9]{0,18}"))exact=Long.parseLong(q);}catch(NumberFormatException ignored){}
  String pattern="%"+q.replace("!","!!").replace("%","!%").replace("_","!_")+"%";
  var result=products.search(pattern,exact,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id")));
  Set<Long> used=result.isEmpty()?Set.of():new HashSet<>(products.usedIds(result.getContent().stream().map(Product::getId).toList()));
  return new ProductPage(result.stream().map(p->response(p,used.contains(p.getId()))).toList(),page,size,""+result.getTotalElements(),result.getTotalPages());
 }
 @Transactional(readOnly=true)
 public AdminProductResponse detail(long id){var p=products.findById(id).orElseThrow(()->new ProductException(404,"PRODUCT_NOT_FOUND"));return response(p,used(id));}
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public AdminProductResponse create(ProductInput input,ProductImageStorage.Staged image){
  String url=publish(image);
  var product=products.saveAndFlush(Product.create(input.name(),input.description(),input.quantity(),input.price(),url));
  return response(product,false);
 }
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public AdminProductResponse update(long id,ProductInput input,String expected,ProductImageStorage.Staged image){
  if(expected==null||expected.isBlank())throw new ProductException(428,"VERSION_REQUIRED");
  var product=products.findForUpdate(id).orElseThrow(()->new ProductException(404,"PRODUCT_NOT_FOUND"));
  if(used(id))throw new ProductException(409,"PRODUCT_IN_USE");
  if(!ProductVersion.of(product).equals(expected))throw new ProductException(412,"PRODUCT_CHANGED");
  String url=switch(input.imageAction()){case "REMOVE"->null;case "REPLACE"->publish(image);default->product.getImageUrl();};
  product.update(input.name(),input.description(),input.quantity(),input.price(),url);
  products.flush();return response(product,false);
 }
 private boolean used(long id){return !products.usedIds(List.of(id)).isEmpty();}
 private String publish(ProductImageStorage.Staged staged){
  if(staged==null)return null;
  // Register before moving so even a later persistence failure removes the new immutable file.
  TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
   @Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)images.rollbackPublished(staged);}
  });
  return images.publish(staged);
 }
 private AdminProductResponse response(Product p,boolean used){return new AdminProductResponse(""+p.getId(),p.getName(),p.getDescription(),p.getQuantity(),p.getEstimatedPrice()==null?null:""+p.getEstimatedPrice(),p.getImageUrl(),!used,used?"PRODUCT_IN_USE":null,ProductVersion.of(p));}
}
