package com.group6.auction.product.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "estimated_price")
    private Long estimatedPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    protected Product() {
    }

    public static Product create(String name, String description, int quantity, Long price, String imageUrl) {
        Product product = new Product();
        product.update(name, description, quantity, price, imageUrl);
        return product;
    }

    public void update(String name, String description, int quantity, Long price, String imageUrl) {
        this.name = name;
        this.description = description;
        this.quantity = quantity;
        this.estimatedPrice = price;
        this.imageUrl = imageUrl;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public Long getEstimatedPrice() {
        return estimatedPrice;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public String getImageUrl() {
        return imageUrl;
    }
}
