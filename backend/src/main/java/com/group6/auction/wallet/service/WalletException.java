package com.group6.auction.wallet.service;
public class WalletException extends RuntimeException {
 private final String code;
 private final int status;
 public WalletException(int status,String code) { super(code); this.code=code; this.status=status; }
 public String code(){return code;}
 public int status(){return status;}
 public static WalletException conflict(String code){return new WalletException(409,code);}
}
