package com.group6.auction.realtime.room;

import com.group6.auction.realtime.connection.RealtimePrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import java.util.concurrent.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class RoomMembershipRaceTest {
 @Test void joiningDuringLastMemberRemovalKeepsBothIndexes() throws Exception {
  for(boolean disconnect:List.of(false,true)){
   var access=mock(RoomAccessService.class);when(access.authorizeAndRegister(anyLong(),anyLong(),any())).thenReturn(RoomAccessResult.success());
   var service=new RoomMembershipService(access,mock(RoomDataGateway.class));
   var user=new RealtimePrincipal(2,"alice",RealtimePrincipal.Role.USER);
   service.join("old",user,1,null);
   var observedEmpty=new CountDownLatch(1);var release=new CountDownLatch(1);
   var backing=ConcurrentHashMap.<String>newKeySet();backing.add("old");
   Set<String> pausing=new AbstractSet<>(){
    public Iterator<String> iterator(){return backing.iterator();}
    public int size(){return backing.size();}
    public boolean add(String s){return backing.add(s);}
    public boolean remove(Object s){return backing.remove(s);}
    public boolean isEmpty(){boolean empty=backing.isEmpty();if(empty){observedEmpty.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("release timed out");}catch(InterruptedException e){throw new RuntimeException(e);}}return empty;}
   };
   @SuppressWarnings("unchecked") var reverse=(Map<Long,Set<String>>)ReflectionTestUtils.getField(service,"sessionsByAuction");
   reverse.put(1L,pausing);
   try(var executor=Executors.newFixedThreadPool(2)){
    var leave=executor.submit(()->{if(disconnect)service.disconnect("old");else service.leave("old",user,1);});
    assertThat(observedEmpty.await(5,TimeUnit.SECONDS)).isTrue();
    var join=executor.submit(()->service.join("new",user,1,null));
    try{join.get(1,TimeUnit.SECONDS);}catch(TimeoutException expected){/* A correct atomic update blocks until removal completes. */}
    finally{release.countDown();}
    leave.get(5,TimeUnit.SECONDS);assertThat(join.get(5,TimeUnit.SECONDS).allowed()).isTrue();
    assertThat(service.auctionIdsForSession("new")).containsExactly(1L);
    assertThat(service.sessionIdsForAuction(1)).containsExactly("new");
   }finally{release.countDown();}
  }
 }
}
