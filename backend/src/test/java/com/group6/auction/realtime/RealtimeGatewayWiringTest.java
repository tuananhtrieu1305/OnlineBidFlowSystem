package com.group6.auction.realtime;

import com.group6.auction.realtime.chat.ChatMessageStore;
import com.group6.auction.realtime.chat.JpaChatMessageStore;
import com.group6.auction.realtime.replay.JpaReplayDataGateway;
import com.group6.auction.realtime.replay.ReplayDataGateway;
import com.group6.auction.realtime.room.AuctionSnapshotDataGateway;
import com.group6.auction.realtime.room.JpaAuctionSnapshotDataGateway;
import com.group6.auction.realtime.room.JpaRoomDataGateway;
import com.group6.auction.realtime.room.RoomDataGateway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration"
})
class RealtimeGatewayWiringTest {
    @Autowired
    private RoomDataGateway roomDataGateway;

    @Autowired
    private AuctionSnapshotDataGateway auctionSnapshotDataGateway;

    @Autowired
    private ReplayDataGateway replayDataGateway;

    @Autowired
    private ChatMessageStore chatMessageStore;

    @Test
    void realtimeGatewaysPreferJpaCapableImplementationsOverNoopFallbacks() {
        assertThat(roomDataGateway).isInstanceOf(JpaRoomDataGateway.class);
        assertThat(auctionSnapshotDataGateway).isInstanceOf(JpaAuctionSnapshotDataGateway.class);
        assertThat(replayDataGateway).isInstanceOf(JpaReplayDataGateway.class);
        assertThat(chatMessageStore).isInstanceOf(JpaChatMessageStore.class);
    }
}
