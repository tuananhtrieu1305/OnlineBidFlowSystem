package com.group6.auction.auction.configuration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.auction.entity.*;
import com.group6.auction.auction.repository.AuctionRepository;
import com.group6.auction.product.repository.ProductRepository;
import com.group6.auction.product.service.ProductVersion;
import com.group6.auction.account.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.sql.*;
import java.util.*;
import java.security.*;

@Service @Profile("!probe")
public class AuctionConfigurationService {
 private final AuctionRepository auctions;private final ProductRepository products;private final UserRepository users;
 private final JdbcTemplate jdbc;private final Clock clock;private final ObjectMapper json;
 private final SecureRandom random=new SecureRandom();
 private static final String BASE="SELECT a.*,p.name AS product_name,p.image_url AS product_image,"+
  "(SELECT COUNT(*) FROM auction_participants ap WHERE ap.auction_id=a.id) AS participants,"+
  "(EXISTS(SELECT 1 FROM bids b WHERE b.auction_id=a.id) OR EXISTS(SELECT 1 FROM chat_messages c WHERE c.auction_id=a.id) OR EXISTS(SELECT 1 FROM coin_transactions t WHERE t.auction_id=a.id)) AS activity FROM auctions a JOIN products p ON p.id=a.product_id";
 public AuctionConfigurationService(AuctionRepository auctions,ProductRepository products,UserRepository users,JdbcTemplate jdbc,Clock clock,ObjectMapper json){this.auctions=auctions;this.products=products;this.users=users;this.jdbc=jdbc;this.clock=clock;this.json=json;}
 @Transactional(readOnly=true)
 public Map<String,Object> detail(long id){var rows=jdbc.query(BASE+" WHERE a.id=?",(rs,n)->view(rs),id);if(rows.isEmpty())throw error(404,"AUCTION_NOT_FOUND");return rows.getFirst();}
 @Transactional(readOnly=true)
 public Map<String,Object> list(String q,String status,String type,String access,int page,int size){
  q=q==null?"":q.strip();if(q.codePointCount(0,q.length())>255||page<0||size<1||size>100||(long)page*size>Integer.MAX_VALUE)throw error(400,"INVALID_FILTER");
  String where=" WHERE 1=1";List<Object> params=new ArrayList<>();
  if(!q.isEmpty()){
   long id=-1;try{if(q.matches("[1-9][0-9]{0,18}"))id=Long.parseLong(q);}catch(NumberFormatException ignored){}
   where+=" AND (p.name LIKE ? ESCAPE '!' OR a.id=?)";params.add("%"+q.replace("!","!!").replace("%","!%").replace("_","!_")+"%");params.add(id);
  }
  String[] values={status,type,access};String[] columns={"status","auction_type","access_type"};
  List<Set<String>> allowed=List.of(Set.of("UPCOMING","RUNNING","SOLD","UNSOLD"),Set.of("NORMAL","BLIND"),Set.of("PUBLIC","PRIVATE"));
  for(int i=0;i<3;i++){if(values[i]!=null&&!values[i].isEmpty()){if(!allowed.get(i).contains(values[i]))throw error(400,"INVALID_FILTER");where+=" AND a."+columns[i]+"=?";params.add(values[i]);}}
  long count=jdbc.queryForObject("SELECT COUNT(*) FROM auctions a JOIN products p ON p.id=a.product_id"+where,Long.class,params.toArray());
  params.add(size);params.add((long)page*size);
  var items=jdbc.query(BASE+where+" ORDER BY a.id DESC LIMIT ? OFFSET ?",(rs,n)->{
   var value=view(rs);for(String key:List.of("roomCode","startingPrice","minBidIncrement","createdBy","winnerUserId","winningPrice","finishedAt","version"))value.remove(key);return value;
  },params.toArray());
  return Map.of("items",items,"page",page,"size",size,"totalElements",""+count,"totalPages",(count+size-1)/size,"serverNow",clock.instant().toString());
 }
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public Map<String,Object> create(String username,AuctionInput input){
  var admin=users.findByUsername(username).filter(u->"ADMIN".equals(u.getRole())).orElseThrow(()->error(403,"FORBIDDEN"));
  var product=products.findForUpdate(input.productId()).orElseThrow(()->error(404,"PRODUCT_NOT_FOUND"));
  if(!ProductVersion.of(product).equals(input.productVersion()))throw error(412,"PRODUCT_CHANGED");
  future(input);
  var auction=auctions.saveAndFlush(Auction.create(product.getId(),admin.getId(),input.type(),input.access(),input.price(),input.increment(),input.capacity(),input.access()==AuctionAccessType.PRIVATE?code():null,input.start(),input.end()));
  return detail(auction.getId());
 }
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public Map<String,Object> update(long id,AuctionInput input,String version){
  if(version==null||version.isBlank())throw error(428,"VERSION_REQUIRED");
  var auction=auctions.findForUpdate(id).orElseThrow(()->error(404,"AUCTION_NOT_FOUND"));
  var current=detail(id);
  if(!Boolean.TRUE.equals(current.get("editable")))throw error(409,(String)current.get("editBlockedReason"));
  if(!version.equals(current.get("version")))throw error(412,"AUCTION_CHANGED");
  future(input);
  String code=input.access()==AuctionAccessType.PUBLIC?null:auction.getRoomCode()==null?code():auction.getRoomCode();
  auction.configure(input.type(),input.access(),input.price(),input.increment(),input.capacity(),code,input.start(),input.end());
  auctions.flush();return detail(id);
 }
 private void future(AuctionInput input){if(!input.start().isAfter(LocalDateTime.ofInstant(clock.instant(),ZoneOffset.UTC)))throw error(409,"START_TIME_PASSED");}
 private String code(){String alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";StringBuilder code=new StringBuilder();for(int i=0;i<12;i++)code.append(alphabet.charAt(random.nextInt(alphabet.length())));return code.toString();}
 private Map<String,Object> view(ResultSet rs)throws SQLException{
  Map<String,Object> v=new LinkedHashMap<>();
  for(String key:List.of("id","product_id","created_by","starting_price","min_bid_increment","winner_user_id","winning_price"))v.put(camel(key),rs.getString(key));
  for(String key:List.of("auction_type","access_type","status","room_code"))v.put(camel(key),rs.getString(key));
  v.put("maxParticipants",rs.getObject("max_participants",Integer.class));
  for(String key:List.of("start_time","end_time","finished_at")){var time=rs.getObject(key,LocalDateTime.class);v.put(camel(key),time==null?null:time.toInstant(ZoneOffset.UTC).toString());}
  try{v.put("version","\""+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(v)))+"\"");}catch(Exception ex){throw new IllegalStateException(ex);}
  Map<String,Object> product=new LinkedHashMap<>();product.put("id",rs.getString("product_id"));product.put("name",rs.getString("product_name"));product.put("imageUrl",rs.getString("product_image"));v.put("product",product);
  long participants=rs.getLong("participants");v.put("participantCount",""+participants);
  String blocked=!"UPCOMING".equals(v.get("status"))?"AUCTION_NOT_EDITABLE":!rs.getObject("start_time",LocalDateTime.class).isAfter(LocalDateTime.ofInstant(clock.instant(),ZoneOffset.UTC))?"START_TIME_REACHED":participants>0||rs.getBoolean("activity")?"AUCTION_HAS_ACTIVITY":null;
  v.put("editable",blocked==null);v.put("editBlockedReason",blocked);v.put("serverNow",clock.instant().toString());return v;
 }
 private String camel(String value){String[] parts=value.split("_");StringBuilder result=new StringBuilder(parts[0]);for(int i=1;i<parts.length;i++)result.append(Character.toUpperCase(parts[i].charAt(0))).append(parts[i].substring(1));return result.toString();}
 private AuctionConfigurationException error(int status,String code){return new AuctionConfigurationException(status,code);}
}
