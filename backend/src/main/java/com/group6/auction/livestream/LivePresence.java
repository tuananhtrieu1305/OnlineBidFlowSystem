package com.group6.auction.livestream;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Profile("!probe")
public class LivePresence {
    public static final class Client {
        public final String connectionId = UUID.randomUUID().toString();
        public final WebSocketSession socket;
        public final RealtimePrincipal actor;
        public volatile Long roomId;
        public volatile boolean host;
        public Client(WebSocketSession socket, RealtimePrincipal actor) { this.socket = socket; this.actor = actor; }
    }
    private final Map<String, Client> clients = new ConcurrentHashMap<>();
    public Client register(WebSocketSession socket, RealtimePrincipal actor) {
        Client client = new Client(socket, actor);
        clients.put(socket.getId(), client);
        return client;
    }
    public Client client(String socketId) { return clients.get(socketId); }
    public List<Client> all() { return List.copyOf(clients.values()); }
    public List<Client> room(long id) {
        return clients.values().stream().filter(c -> Objects.equals(c.roomId, id) && c.socket.isOpen()).toList();
    }
    public Client host(long id) { return room(id).stream().filter(c -> c.host).findFirst().orElse(null); }
    public boolean joined(long sessionId, long userId) { return room(sessionId).stream().anyMatch(c -> c.actor.userId() == userId); }
    public synchronized void join(Client client, long id, boolean host) {
        if (client.roomId != null && !Objects.equals(client.roomId, id)) throw LiveException.conflict("Rời phòng hiện tại trước khi vào phòng mới.");
        if (host && room(id).stream().anyMatch(c -> c.host && c != client)) throw LiveException.conflict("Host đang mở phòng ở một cửa sổ khác.");
        if (!host && room(id).stream().filter(c -> !c.host && c != client).count() >= 10) throw LiveException.conflict("Phòng đã đủ 10 kết nối người xem.");
        client.host = host;
        client.roomId = id;
    }
    public void leave(Client client) { client.roomId = null; client.host = false; }
    public Client remove(String socketId) { return clients.remove(socketId); }
}
