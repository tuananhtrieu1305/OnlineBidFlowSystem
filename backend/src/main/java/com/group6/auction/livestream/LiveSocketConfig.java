package com.group6.auction.livestream;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.socket.config.annotation.*;
import com.group6.auction.realtime.connection.SessionRealtimeHandshakeInterceptor;
@Configuration @Profile("!probe")
public class LiveSocketConfig implements WebSocketConfigurer {
    private final LiveSocketHandler handler;private final SessionRealtimeHandshakeInterceptor auth;private final String[] origins;
    public LiveSocketConfig(LiveSocketHandler handler,SessionRealtimeHandshakeInterceptor auth,@Value("${app.cors.allowed-origins}")String[] origins){this.handler=handler;this.auth=auth;this.origins=origins;}
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){registry.addHandler(handler,"/ws/livestream").addInterceptors(auth).setAllowedOrigins(origins);}
}
