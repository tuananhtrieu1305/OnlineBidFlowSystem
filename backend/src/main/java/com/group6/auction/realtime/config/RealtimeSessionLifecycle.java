package com.group6.auction.realtime.config;

import jakarta.servlet.http.*;
import com.group6.auction.realtime.connection.RealtimeSessionRegistry;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration @EnableScheduling
public class RealtimeSessionLifecycle {
    @Bean ServletListenerRegistrationBean<SessionListener> realtimeSessionListener(RealtimeSessionRegistry registry) {
        return new ServletListenerRegistrationBean<>(new SessionListener(registry));
    }
    static class SessionListener implements HttpSessionListener, HttpSessionIdListener {
        private final RealtimeSessionRegistry registry;
        SessionListener(RealtimeSessionRegistry registry) { this.registry = registry; }
        @Override public void sessionDestroyed(HttpSessionEvent event) { registry.closeHttpSession(event.getSession().getId()); }
        @Override public void sessionIdChanged(HttpSessionEvent event, String oldId) { registry.closeHttpSession(oldId); }
    }
}
