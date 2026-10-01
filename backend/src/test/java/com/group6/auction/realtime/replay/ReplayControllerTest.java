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
    private final com.group6.auction.realtime.connection.RealtimeAuthService auth = mock(com.group6.auction.realtime.connection.RealtimeAuthService.class);
    private final ReplayController controller = new ReplayController(replayService, auth);
    private org.springframework.security.core.Authentication identity(long id) {
        var authentication = mock(org.springframework.security.core.Authentication.class);
        when(auth.authenticate(authentication)).thenReturn(java.util.Optional.of(new RealtimePrincipal(id, "user-" + id, RealtimePrincipal.Role.USER)));
        return authentication;
    }

    @Test
    void rejectsMissingAuthentication() {
        var response = controller.replay(1L, null);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "error", Map.of("code", "INVALID_AUTH", "message", "Authentication is required.")
        ));
    }

    @Test
    void passesViewerToReplayService() {
        var replay = new ReplayResponse(1L, "NORMAL", "SOLD", "USER", null, null, null, java.util.List.of());
        when(replayService.buildReplay(1L, new ReplayViewer(2L, RealtimePrincipal.Role.USER))).thenReturn(replay);

        var response = controller.replay(1L, identity(2L));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isSameAs(replay);
        verify(replayService).buildReplay(1L, new ReplayViewer(2L, RealtimePrincipal.Role.USER));
    }

    @Test
    void mapsServiceErrorsToHttpStatus() {
        when(replayService.buildReplay(1L, new ReplayViewer(9L, RealtimePrincipal.Role.USER)))
                .thenThrow(ReplayException.forbidden("REPLAY_FORBIDDEN", "Viewer cannot access this replay."));

        var response = controller.replay(1L, identity(9L));

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        assertThat(response.getBody()).isEqualTo(Map.of(
                "error", Map.of("code", "REPLAY_FORBIDDEN", "message", "Viewer cannot access this replay.")
        ));
    }
}
