package com.group6.auction.realtime.replay;

import java.util.Map;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReplayControllerTest {
    private final ReplayService replayService = mock(ReplayService.class);
    private final ReplayController controller = new ReplayController(replayService);

    @Test
    void rejectsMissingMockAuthHeaders() {
        var response = controller.replay(1L, null, null);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "error", Map.of("code", "INVALID_AUTH", "message", "X-Dev-User-Id and X-Dev-Role are required.")
        ));
    }

    @Test
    void passesViewerToReplayService() {
        var replay = new ReplayResponse(1L, "NORMAL", "SOLD", "USER", null, null, null, java.util.List.of());
        when(replayService.buildReplay(1L, new ReplayViewer(2L, RealtimePrincipal.Role.USER))).thenReturn(replay);

        var response = controller.replay(1L, "2", "USER");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isSameAs(replay);
        verify(replayService).buildReplay(1L, new ReplayViewer(2L, RealtimePrincipal.Role.USER));
    }

    @Test
    void mapsServiceErrorsToHttpStatus() {
        when(replayService.buildReplay(1L, new ReplayViewer(9L, RealtimePrincipal.Role.USER)))
                .thenThrow(ReplayException.forbidden("REPLAY_FORBIDDEN", "Viewer cannot access this replay."));

        var response = controller.replay(1L, "9", "USER");

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "error", Map.of("code", "REPLAY_FORBIDDEN", "message", "Viewer cannot access this replay.")
        ));
    }
}
