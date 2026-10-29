package com.group6.auction.wallet.service;

import java.util.HashMap;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Wallet-owned Coin transfer for a validated Clue purchase. Caller locks the auction first. */
@Service
@Profile("!probe")
@Transactional(propagation=Propagation.MANDATORY)
public class ClueTradeTransferService {
    private final WalletLedger ledger;
    public ClueTradeTransferService(WalletLedger ledger){this.ledger=ledger;}

    public void transfer(long auctionId,long buyerUserId,long sellerUserId,long amount){
        if(amount<=0||buyerUserId==sellerUserId)throw new WalletException(400,"INVALID_CLUE_TRADE");
        long buyerId=ledger.byUser(buyerUserId).id(),sellerId=ledger.byUser(sellerUserId).id();
        var balances=new HashMap<Long,WalletLedger.Balance>();
        for(long id:List.of(Math.min(buyerId,sellerId),Math.max(buyerId,sellerId)))balances.put(id,ledger.lock(id));
        ledger.change(balances.get(buyerId),auctionId,"CLUE_TRADE",-amount,0);
        ledger.change(balances.get(sellerId),auctionId,"CLUE_TRADE",amount,0);
    }
}
