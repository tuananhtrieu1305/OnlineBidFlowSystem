package com.group6.auction.livestream;
import com.fasterxml.jackson.databind.*;
import com.group6.auction.realtime.connection.*;
import org.springframework.context.annotation.*;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.transaction.event.*;
import java.util.*;
@Component @Profile("!probe")
public class LiveSocketHandler extends TextWebSocketHandler {
    private final LivePresence presence;private final LiveService service;private final LiveQueries queries;private final ObjectMapper json;private final RealtimeSessionRegistry registry;
    public LiveSocketHandler(LivePresence presence,LiveService service,LiveQueries queries,ObjectMapper json,RealtimeSessionRegistry registry){this.presence=presence;this.service=service;this.queries=queries;this.json=json;this.registry=registry;}
    private void send(LivePresence.Client c,Object message){try{c.socket.sendMessage(new TextMessage(json.writeValueAsString(message)));}catch(Exception e){try{c.socket.close(CloseStatus.SERVER_ERROR);}catch(Exception ignored){}}}
    @Override public void afterConnectionEstablished(WebSocketSession socket)throws Exception {
        socket.setTextMessageSizeLimit(65536);
        if(!(socket.getAttributes().get(SessionRealtimeHandshakeInterceptor.PRINCIPAL_ATTRIBUTE) instanceof RealtimePrincipal actor)||!SocketSessionLease.valid(socket)){socket.close(CloseStatus.POLICY_VIOLATION);return;}
        var safe=new AuthenticatedWebSocketSession(socket);registry.register(safe,actor);var c=presence.register(safe,actor);send(c,Map.of("type","WELCOME","connectionId",c.connectionId));
    }
    private void state(LivePresence.Client c,String reason){if(c.roomId!=null)send(c,Map.of("type","STATE","reason",reason,"data",queries.snapshot(c.roomId,c.actor)));}
    @Override protected void handleTextMessage(WebSocketSession socket,TextMessage message)throws Exception {
        var c=presence.client(socket.getId());if(c==null||!SocketSessionLease.valid(socket)){socket.close(CloseStatus.POLICY_VIOLATION);return;}
        try {
            if(message.getPayloadLength()>65536)throw new LiveException(400,"MESSAGE_TOO_LARGE","Thông điệp quá lớn.");
            JsonNode p=json.readTree(message.getPayload());String type=p.path("type").asText();
            if(type.equals("JOIN")){long id=Long.parseLong(p.path("sessionId").asText());boolean first=c.roomId==null;if(!first&&c.roomId==id){state(c,"SNAPSHOT");return;}try{service.join(id,c);}catch(Exception e){presence.leave(c);throw e;}state(c,"SNAPSHOT");return;}
            if(c.roomId==null)throw new LiveException(403,"JOIN_REQUIRED","Chưa vào phòng.");
            long id=c.roomId;
            switch(type){
                case "LEAVE" -> {presence.leave(c);service.disconnected(id,socket.getId());}
                case "HEARTBEAT" -> service.heartbeat(id,c);
                case "MEDIA_READY" -> service.ready(id,c,p.path("ready").asBoolean());
                case "SIGNAL" -> {
                    var s=queries.session(id,true);if(!p.path("generation").asText().equals(s.get("mediaGeneration")))throw LiveException.conflict("Thế hệ video đã thay đổi.");
                    var target=presence.room(id).stream().filter(x->x.connectionId.equals(p.path("target").asText())).findFirst().orElseThrow(()->LiveException.conflict("Người nhận đã rời phòng."));
                    String kind=p.path("kind").asText();if(c==target||c.host==target.host||!Set.of("OFFER","ANSWER","ICE","RESTART").contains(kind)||kind.equals("OFFER")&&!c.host||Set.of("ANSWER","RESTART").contains(kind)&&c.host)throw new LiveException(403,"SIGNAL_FORBIDDEN","Signaling không hợp lệ.");
                    send(target,Map.of("type","SIGNAL","sender",c.connectionId,"generation",s.get("mediaGeneration"),"kind",kind,"epoch",p.path("epoch").asText(),"data",p.path("data")));
                }
                default -> throw new LiveException(400,"INVALID_MESSAGE","Thông điệp không hợp lệ.");
            }
        }catch(Exception e){send(c,Map.of("type","ERROR","message",e instanceof LiveException?e.getMessage():"Không thực hiện được yêu cầu."));}
    }
    @Override public void afterConnectionClosed(WebSocketSession socket,CloseStatus status){registry.unregister(socket);var c=presence.remove(socket.getId());if(c!=null&&c.roomId!=null)service.disconnected(c.roomId,socket.getId());}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT) public void changed(LiveChanged event){for(var c:presence.all())try{if(Objects.equals(c.roomId,event.sessionId()))state(c,event.reason());else send(c,Map.of("type","REFRESH"));}catch(Exception ignored){}}
}
