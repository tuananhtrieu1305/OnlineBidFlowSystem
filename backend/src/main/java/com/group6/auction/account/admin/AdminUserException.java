package com.group6.auction.account.admin;
public class AdminUserException extends RuntimeException {
 private final int status;
 public AdminUserException(int status,String code){super(code);this.status=status;}
 public int status(){return status;}
}
