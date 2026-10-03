package com.group6.auction.auction.lifecycle;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

/** Starts eligible sessions only. Settlement remains owned by NORMAL/BLIND services. */
@Service
@Profile("!probe")
public class AuctionStartService {
 private final JdbcTemplate jdbc;
 public AuctionStartService(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public int startDue(LocalDateTime now){
  // Row locks serialize with configuration edits; predicates are rechecked after waiting.
  // Never reopen expired/finished sessions or change winner, balances, or ledger entries.
  return jdbc.update("UPDATE auctions SET status='RUNNING' WHERE status='UPCOMING' AND start_time<=? AND end_time>?",now,now);
 }
}
