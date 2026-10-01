package com.group6.auction.account.admin;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("!probe") @RequestMapping("/api/admin/users")
public class AdminUserController {
 private final AdminUserQueryService users;
 public AdminUserController(AdminUserQueryService users){this.users=users;}
 @GetMapping public Object list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="") String role,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return users.list(q,role,page,size);}
 @GetMapping("/{id}") public Object detail(@PathVariable String id){return users.detail(id(id));}
 @GetMapping("/{id}/transactions") public Object history(@PathVariable String id,@RequestParam(required=false) String type,@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) String cursor){return users.history(id(id),type,limit,cursor);}
 private long id(String raw){try{if(!raw.matches("[1-9][0-9]{0,18}"))throw new NumberFormatException();return Long.parseLong(raw);}catch(NumberFormatException e){throw new AdminUserException(400,"INVALID_ID");}}
}
