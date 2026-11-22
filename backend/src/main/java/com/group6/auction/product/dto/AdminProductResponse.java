package com.group6.auction.product.dto;
public record AdminProductResponse(String id,String name,String description,int quantity,int availableQuantity,String estimatedPrice,String imageUrl,boolean editable,String editBlockedReason,String version) {}
