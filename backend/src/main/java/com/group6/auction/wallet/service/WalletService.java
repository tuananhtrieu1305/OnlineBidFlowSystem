package com.group6.auction.wallet.service;

import com.group6.auction.wallet.entity.Wallet;
import com.group6.auction.wallet.repository.WalletRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Profile("!probe")
public class WalletService {
    private final WalletRepository wallets;
    public WalletService(WalletRepository wallets) { this.wallets = wallets; }
    @Transactional
    public void createUserWallet(Long userId) { wallets.saveAndFlush(new Wallet(userId)); }
}
