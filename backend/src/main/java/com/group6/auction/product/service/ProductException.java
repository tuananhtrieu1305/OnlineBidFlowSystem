package com.group6.auction.product.service;
public class ProductException extends RuntimeException {
 private final int status;
 public ProductException(int status,String code){super(code);this.status=status;}
 public int status(){return status;}
}
