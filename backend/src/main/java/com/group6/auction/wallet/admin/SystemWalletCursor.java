package com.group6.auction.wallet.admin;
import com.group6.auction.wallet.service.WalletException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
public record SystemWalletCursor(LocalDateTime time,long id) {
 public String encode(long wallet,SystemWalletFilters filters){return Base64.getUrlEncoder().withoutPadding().encodeToString(("1\n"+wallet+"\n"+time+"\n"+id+"\n"+filters.key()).getBytes(StandardCharsets.UTF_8));}
 public static SystemWalletCursor decode(String value,long wallet,SystemWalletFilters filters){
  if(value==null)return null;
  try{
   if(value.length()>512)throw new IllegalArgumentException();var p=new String(Base64.getUrlDecoder().decode(value),StandardCharsets.UTF_8).split("\n",-1);
   if(p.length!=5||!p[0].equals("1")||!p[1].equals(""+wallet)||!p[4].equals(filters.key())||!p[3].matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException();
   var t=LocalDateTime.parse(p[2]);if(t.getYear()<1000||t.getYear()>9999||t.getNano()%1000!=0)throw new IllegalArgumentException();return new SystemWalletCursor(t,Long.parseLong(p[3]));
  }catch(RuntimeException e){throw new WalletException(400,"INVALID_CURSOR");}
 }
}
