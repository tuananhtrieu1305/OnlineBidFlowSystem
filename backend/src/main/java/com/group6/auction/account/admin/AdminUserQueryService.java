package com.group6.auction.account.admin;

import com.group6.auction.wallet.service.WalletQueryService;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service @Profile("!probe") @Transactional(readOnly=true)
public class AdminUserQueryService {
 private final JdbcTemplate jdbc;
 private final WalletQueryService wallets;
 public AdminUserQueryService(JdbcTemplate jdbc,WalletQueryService wallets){this.jdbc=jdbc;this.wallets=wallets;}
 public Map<String,Object> list(String q,String role,int page,int size){
  q=q==null?"":q.strip();role=role==null?"":role;
  if(q.length()>50||!Set.of("","USER","ADMIN").contains(role)||page<0||size<1||size>100||(long)page*size>Integer.MAX_VALUE)throw new AdminUserException(400,"INVALID_FILTER");
  String where=" WHERE 1=1";List<Object> args=new ArrayList<>();
  if(!q.isEmpty()){
   long id=-1;try{if(q.matches("[1-9][0-9]{0,18}"))id=Long.parseLong(q);}catch(NumberFormatException ignored){}
   where+=" AND (username LIKE ? ESCAPE '!' OR id=?)";args.add("%"+q.replace("!","!!").replace("%","!%").replace("_","!_")+"%");args.add(id);
  }
  if(!role.isEmpty()){where+=" AND role=?";args.add(role);}
  long total=jdbc.queryForObject("SELECT COUNT(*) FROM users"+where,Long.class,args.toArray());
  args.add(size);args.add((long)page*size);
  var items=jdbc.query("SELECT id,username,role FROM users"+where+" ORDER BY id DESC LIMIT ? OFFSET ?",(rs,n)->Map.of("id",rs.getString("id"),"username",rs.getString("username"),"role",rs.getString("role")),args.toArray());
  return Map.of("items",items,"page",page,"size",size,"totalElements",""+total,"totalPages",(total+size-1)/size);
 }
 public Map<String,Object> detail(long id){
  var rows=jdbc.query("SELECT u.id,u.username,u.role,w.id wallet_id,w.available_balance,w.locked_balance,w.updated_at FROM users u LEFT JOIN wallets w ON w.user_id=u.id AND w.wallet_type='USER' WHERE u.id=?",(rs,n)->{
   Map<String,Object> result=new LinkedHashMap<>();result.put("id",rs.getString("id"));result.put("username",rs.getString("username"));result.put("role",rs.getString("role"));
   String state=!"USER".equals(rs.getString("role"))?"NOT_APPLICABLE":rs.getString("wallet_id")==null?"MISSING":"AVAILABLE";
   result.put("walletState",state);result.put("wallet",state.equals("AVAILABLE")?Map.of("walletId",rs.getString("wallet_id"),"availableBalance",rs.getString("available_balance"),"lockedBalance",rs.getString("locked_balance"),"updatedAt",rs.getObject("updated_at",LocalDateTime.class).toInstant(ZoneOffset.UTC).toString()):null);return result;
  },id);
  if(rows.isEmpty())throw new AdminUserException(404,"USER_NOT_FOUND");return rows.getFirst();
 }
 public WalletQueryService.History history(long id,String type,int limit,String cursor){
  var user=detail(id);
  if(!"AVAILABLE".equals(user.get("walletState")))throw new AdminUserException(409,"MISSING".equals(user.get("walletState"))?"USER_WALLET_MISSING":"WALLET_NOT_APPLICABLE");
  return wallets.history((String)user.get("username"),type==null||type.isEmpty()?null:type,limit,cursor);
 }
}
