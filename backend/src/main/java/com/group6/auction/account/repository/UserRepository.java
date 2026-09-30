package com.group6.auction.account.repository;

import com.group6.auction.account.entity.User;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.repository.JpaRepository;

@Profile("!probe")
public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByUsername(String username);
}
