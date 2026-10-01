package com.group6.auction.product.service;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
public record ProductInput(String name,String description,int quantity,Long price,String imageAction) {
 public static ProductInput parse(JsonNode node,boolean update){
  if(node==null||!node.isObject())throw invalid();
  Set<String> allowed=update?Set.of("name","description","quantity","estimatedPrice","imageAction"):Set.of("name","description","quantity","estimatedPrice");
  node.fieldNames().forEachRemaining(key->{if(!allowed.contains(key))throw invalid();});
  String name=text(node,"name",255,true),description=text(node,"description",5000,false);
  JsonNode quantity=node.path("quantity");
  if(!quantity.isIntegralNumber()||!quantity.canConvertToInt()||quantity.intValue()<1)throw invalid();
  Long price=null;JsonNode amount=node.path("estimatedPrice");
  if(!amount.isMissingNode()&&!amount.isNull()){
   if(!amount.isTextual()||!amount.textValue().matches("[1-9][0-9]{0,18}"))throw invalid();
   try{price=Long.parseLong(amount.textValue());}catch(NumberFormatException ex){throw invalid();}
  }
  String action=update?text(node,"imageAction",10,true):"KEEP";
  if(!Set.of("KEEP","REMOVE","REPLACE").contains(action))throw invalid();
  return new ProductInput(name,description,quantity.intValue(),price,action);
 }
 private static String text(JsonNode node,String field,int max,boolean required){
  var value=node.path(field);
  if(value.isMissingNode()||value.isNull()){if(required)throw invalid();return null;}
  if(!value.isTextual())throw invalid();String text=value.textValue().strip();
  if(text.isEmpty()){if(required)throw invalid();return null;}
  if(text.codePointCount(0,text.length())>max||text.indexOf('\0')>=0)throw invalid();return text;
 }
 private static ProductException invalid(){return new ProductException(400,"INVALID_PRODUCT");}
}
