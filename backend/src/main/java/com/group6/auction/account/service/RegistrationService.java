package com.group6.auction.account.service;

import com.group6.auction.account.dto.UserResponse;
import com.group6.auction.account.entity.User;
import com.group6.auction.account.repository.UserRepository;
import com.group6.auction.wallet.service.WalletService;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Profile("!probe")
public class RegistrationService {
    private final UserRepository users;
    private final WalletService wallets;
    public RegistrationService(UserRepository users, WalletService wallets) {
        this.users = users;
        this.wallets = wallets;
    }
    @Transactional
    public UserResponse register(String username, String hash) {
        User user = users.saveAndFlush(new User(username, hash));
        wallets.createUserWallet(user.getId());
        return new UserResponse(user.getId(), user.getUsername(), "USER");
    }
}
