package com.group6.auction.auction.discovery;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.sql.*;
import java.time.*;
import java.util.*;

@Service @Profile("!probe")
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class DiscoveryService {
 private final JdbcTemplate jdbc;
 private final Clock clock;
 // Explicit projection: never serialize the admin DTO or a JPA entity publicly.
 private static final String FROM=" FROM auctions a JOIN products p ON p.id=a.product_id";
 private static final String SELECT="SELECT a.id,a.auction_type,a.status,a.start_time,a.end_time,a.starting_price,a.min_bid_increment,p.id AS product_id,p.name,p.description,p.quantity,p.image_url,(SELECT MAX(b.amount) FROM bids b WHERE b.auction_id=a.id) AS highest";
 public DiscoveryService(JdbcTemplate jdbc,Clock clock){this.jdbc=jdbc;this.clock=clock;}
 public Map<String,Object> list(String q,String status,String type,int page,int size){
  q=q.strip();if(q.length()>255||page<0||size<1||size>100||(long)page*size>Integer.MAX_VALUE
   ||(!status.isEmpty()&&!Set.of("UPCOMING","RUNNING","SOLD","UNSOLD").contains(status))
   ||(!type.isEmpty()&&!Set.of("NORMAL","BLIND").contains(type)))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  String where=" WHERE a.access_type='PUBLIC'";List<Object> args=new ArrayList<>();
  if(!q.isEmpty()){where+=" AND p.name LIKE ? ESCAPE '!'";args.add("%"+q.replace("!","!!").replace("%","!%").replace("_","!_")+"%");}
  if(!status.isEmpty()){where+=" AND a.status=?";args.add(status);}
  if(!type.isEmpty()){where+=" AND a.auction_type=?";args.add(type);}
  long total=jdbc.queryForObject("SELECT COUNT(*)"+FROM+where,Long.class,args.toArray());
  args.add(size);args.add((long)page*size);
  var items=jdbc.query(SELECT+FROM+where+" ORDER BY a.id DESC LIMIT ? OFFSET ?",(rs,n)->view(rs,false),args.toArray());
  return Map.of("items",items,"page",page,"totalPages",(total+size-1)/size,"totalElements",Long.toString(total),"serverNow",clock.instant().toString());
 }
 public Map<String,Object> detail(long id){
  var rows=jdbc.query(SELECT+FROM+" WHERE a.access_type='PUBLIC' AND a.id=?",(rs,n)->view(rs,true),id);
  if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);return rows.getFirst();
 }
 private Map<String,Object> view(ResultSet rs,boolean detail)throws SQLException{
  Map<String,Object> result=new LinkedHashMap<>(),product=new LinkedHashMap<>();
  result.put("id",rs.getString("id"));result.put("auctionType",rs.getString("auction_type"));result.put("status",rs.getString("status"));
  result.put("startTime",rs.getObject("start_time",LocalDateTime.class).toInstant(ZoneOffset.UTC).toString());
  result.put("endTime",rs.getObject("end_time",LocalDateTime.class).toInstant(ZoneOffset.UTC).toString());
  result.put("serverNow",clock.instant().toString());
  product.put("id",rs.getString("product_id"));product.put("name",rs.getString("name"));product.put("imageUrl",rs.getString("image_url"));
  if(detail){product.put("description",rs.getString("description"));product.put("quantity",rs.getInt("quantity"));}
  result.put("product",product);
  if("NORMAL".equals(rs.getString("auction_type"))){
   result.put("startingPrice",rs.getString("starting_price"));result.put("minBidIncrement",rs.getString("min_bid_increment"));
   result.put("currentPrice",rs.getString("highest")==null?rs.getString("starting_price"):rs.getString("highest"));
  }
  return result;
 }
}
