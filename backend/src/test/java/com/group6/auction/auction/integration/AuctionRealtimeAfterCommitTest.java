package com.group6.auction.auction.integration;

import com.group6.auction.realtime.connection.RealtimeEventPublisher;
import com.group6.auction.realtime.protocol.*;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuctionRealtimeAfterCommitTest {
    @Test void transportFailuresNeverEscapeAfterCommit() throws Exception {
        var publisher=mock(RealtimeEventPublisher.class);
        var listener=new AuctionRealtimeAfterCommit(publisher);
        doThrow(new IOException("socket closed")).when(publisher).broadcastAuctionFinished(eq(1L),any());
        doThrow(new IllegalStateException("socket closed")).when(publisher).sendBlindBidAccepted(eq(2L),eq(1L),any());
        assertThatCode(()->listener.publish(new AuctionIntegrationEvent.Finished(new AuctionFinishedPayload(1,"SOLD",2L,100L)))).doesNotThrowAnyException();
        assertThatCode(()->listener.publish(new AuctionIntegrationEvent.BlindAccepted(2,new BlindBidAcceptedPayload(1,100,"5")))).doesNotThrowAnyException();
    }
}
