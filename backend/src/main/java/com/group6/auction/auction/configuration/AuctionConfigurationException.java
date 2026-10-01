package com.group6.auction.auction.configuration;
public class AuctionConfigurationException extends RuntimeException {
 private final int status;
 public AuctionConfigurationException(int status,String code){super(code);this.status=status;}
 public int status(){return status;}
}
