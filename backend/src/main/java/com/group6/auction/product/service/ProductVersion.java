package com.group6.auction.product.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.product.entity.Product;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
public final class ProductVersion {
 private ProductVersion(){}
 public static String of(Product p){
  try{
   byte[] canonical=new ObjectMapper().writeValueAsBytes(Arrays.asList(p.getId(),p.getName(),p.getDescription(),p.getQuantity(),p.getEstimatedPrice(),p.getImageUrl()));
   return "\""+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical))+"\"";
  }catch(Exception ex){throw new IllegalStateException("Cannot encode product version",ex);}
 }
}
