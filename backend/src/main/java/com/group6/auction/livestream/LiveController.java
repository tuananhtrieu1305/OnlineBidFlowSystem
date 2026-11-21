package com.group6.auction.livestream;
import com.group6.auction.realtime.connection.*;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import jakarta.validation.Valid;
import java.util.*;
import java.time.Clock;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
@RestController @Profile("!probe")
public class LiveController {
    private final LiveService service;private final LiveQueries queries;private final RealtimeAuthService auth;private final LivePresence presence;private final Clock clock;
    @Value("${app.livestream.turn-host:}") private String turnHost;
    @Value("${app.livestream.turn-secret:}") private String turnSecret;
    public LiveController(LiveService service,LiveQueries queries,RealtimeAuthService auth,LivePresence presence,Clock clock){this.service=service;this.queries=queries;this.auth=auth;this.presence=presence;this.clock=clock;}
    private RealtimePrincipal actor(Authentication a){return auth.authenticate(a).orElseThrow(()->new LiveException(401,"UNAUTHENTICATED","Cần đăng nhập."));}
    @GetMapping("/api/livestreams") public Object list(){return queries.list();}
    @GetMapping("/api/admin/livestreams") public Object adminList(){return queries.list();}
    @GetMapping("/api/admin/livestreams/{id}") public Object adminDetail(@PathVariable long id){return queries.session(id,true);}
    @GetMapping("/api/livestreams/{id:[0-9]+}") public Object detail(@PathVariable long id){return queries.session(id,false);}
    @GetMapping("/api/livestreams/state") public Object state(Authentication a){return queries.state(actor(a));}
    @GetMapping("/api/livestreams/purchases") public Object purchases(Authentication a){return queries.purchases(actor(a));}
    @GetMapping("/api/livestreams/{id}/snapshot") public Object snapshot(@PathVariable long id,Authentication a){return queries.snapshot(id,actor(a));}
    @PostMapping("/api/livestreams/{id}/registration") public Object registration(@PathVariable long id,Authentication a,@Valid @RequestBody LiveInput.Registration in){var actor=actor(a);service.register(id,actor,in.registered());return queries.state(actor);}
    @PostMapping("/api/livestreams/{id}/lots/{lotId}/bids") public Object bid(@PathVariable long id,@PathVariable long lotId,Authentication a,@Valid @RequestBody LiveInput.Bid in){var actor=actor(a);service.bid(id,lotId,actor,in);return queries.snapshot(id,actor);}
    @PostMapping("/api/livestreams/{id}/chat") public Object chat(@PathVariable long id,Authentication a,@Valid @RequestBody LiveInput.Chat in){var actor=actor(a);service.chat(id,actor,in);return queries.snapshot(id,actor);}
    @PostMapping("/api/admin/livestreams") public Object create(Authentication a,@Valid @RequestBody LiveInput.Create in){return Map.of("id",Long.toString(service.create(actor(a),in)));}
    @PostMapping("/api/admin/livestreams/{id}/{command}") public Object command(@PathVariable long id,@PathVariable String command,Authentication a,@Valid @RequestBody LiveInput.Command in){var actor=actor(a);service.command(id,actor,command,in);return queries.snapshot(id,actor);}
    @GetMapping("/api/livestreams/{id}/ice-config") public org.springframework.http.ResponseEntity<?> ice(@PathVariable long id,Authentication a) throws Exception {
        var actor=actor(a);if(!presence.joined(id,actor.userId()))throw new LiveException(403,"JOIN_REQUIRED","Hãy vào phòng trước.");
        List<Object> servers=new ArrayList<>();long expires=clock.instant().getEpochSecond()+3600;
        if(!turnHost.isBlank()&&!turnSecret.isBlank()) {String username=expires+":"+actor.userId();var mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec(turnSecret.getBytes(StandardCharsets.UTF_8),"HmacSHA1"));servers.add(Map.of("urls",List.of("turn:"+turnHost+":3478?transport=udp","turn:"+turnHost+":3478?transport=tcp"),"username",username,"credential",Base64.getEncoder().encodeToString(mac.doFinal(username.getBytes(StandardCharsets.UTF_8)))));}
        return org.springframework.http.ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(Map.of("iceServers",servers,"expiresAt",expires*1000));
    }
}
