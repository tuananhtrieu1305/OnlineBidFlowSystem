package com.group6.auction.wallet.repository;

import com.group6.auction.wallet.entity.Wallet;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.repository.JpaRepository;

@Profile("!probe")
public interface WalletRepository extends JpaRepository<Wallet, Long> {}
