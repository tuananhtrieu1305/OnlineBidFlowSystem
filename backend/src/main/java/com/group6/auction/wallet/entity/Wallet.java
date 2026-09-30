package com.group6.auction.wallet.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity @Table(name = "wallets")
public class Wallet {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", unique = true)
    private Long userId;
    @Column(name = "wallet_type", nullable = false)
    private String walletType;
    @Column(name = "available_balance", nullable = false)
    private long availableBalance;
    @Column(name = "locked_balance", nullable = false)
    private long lockedBalance;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Wallet() {}
    public Wallet(Long userId) {
        this.userId = userId;
        this.walletType = "USER";
        this.updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
