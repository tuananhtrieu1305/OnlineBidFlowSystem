package com.group6.auction.auction.integration;

import com.group6.auction.realtime.connection.RealtimeEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import java.io.IOException;

@Component
public class AuctionRealtimeAfterCommit {
    private static final Logger log = LoggerFactory.getLogger(AuctionRealtimeAfterCommit.class);
    private final RealtimeEventPublisher publisher;

    public AuctionRealtimeAfterCommit(RealtimeEventPublisher publisher) { this.publisher = publisher; }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publish(AuctionIntegrationEvent event) {
        try {
            switch (event) {
                case AuctionIntegrationEvent.NormalAccepted normal ->
                    publisher.broadcastNormalPriceUpdated(normal.payload().auctionId(), normal.payload());
                case AuctionIntegrationEvent.BlindAccepted blind ->
                    publisher.sendBlindBidAccepted(blind.userId(), blind.payload().auctionId(), blind.payload());
                case AuctionIntegrationEvent.Finished finished ->
                    publisher.broadcastAuctionFinished(finished.payload().auctionId(), finished.payload());
            }
        } catch (IOException | RuntimeException ex) {
            // The DB already committed. Never turn a transport failure into a retryable bid failure.
            // Do not log payloads or exception messages, which may contain a blind amount.
            log.warn("Auction realtime delivery failed after commit; clients must resync ({})", ex.getClass().getSimpleName());
        }
    }
}
