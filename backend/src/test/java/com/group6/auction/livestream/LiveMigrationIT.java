package com.group6.auction.livestream;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import java.sql.*;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
class LiveMigrationIT {
 @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");}
 @Test void upgradesLegacyAndCreatesFreshSchemaWithoutLosingData()throws Exception {
  String host=System.getenv().getOrDefault("DB_HOST","localhost"),port=System.getenv().getOrDefault("DB_PORT","3306"),user=System.getenv().getOrDefault("DB_USERNAME","root"),password=System.getenv("DB_PASSWORD");
  String base="jdbc:mysql://"+host+":"+port+"/?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC";
  try(var connection=DriverManager.getConnection(base,user,password);var sql=connection.createStatement()) {
   for(boolean legacy:List.of(false,true)) {
    String schema="live_migration_"+UUID.randomUUID().toString().replace("-","");sql.execute("CREATE DATABASE "+schema);
    String url=base.replace("/?","/"+schema+"?");
    try {
     if(legacy)try(var c=DriverManager.getConnection(url,user,password);var stmt=c.createStatement()) {
      String source=Files.readString(Path.of("../database/init.sql"));source=source.substring(source.indexOf("CREATE TABLE users"));
      for(String command:source.split(";"))if(!command.isBlank())stmt.execute(command);
     }
     long before=0;if(legacy)try(var c=DriverManager.getConnection(url,user,password);var stmt=c.createStatement();var r=stmt.executeQuery("SELECT COUNT(*) FROM coin_transactions")){r.next();before=r.getLong(1);}
     Flyway.configure().dataSource(url,user,password).baselineOnMigrate(true).baselineVersion("0").load().migrate();
     try(var c=DriverManager.getConnection(url,user,password);var stmt=c.createStatement()){
      try(var r=stmt.executeQuery("SELECT COUNT(*) FROM livestream_sessions")){r.next();assertThat(r.getLong(1)).isZero();}
      try(var r=stmt.executeQuery("SELECT COUNT(*) FROM wallets WHERE wallet_type='SYSTEM'")){r.next();assertThat(r.getLong(1)).isEqualTo(1);}
      try(var r=stmt.executeQuery("SELECT COUNT(*) FROM coin_transactions")){r.next();assertThat(r.getLong(1)).isEqualTo(before);}
      if(legacy)try(var r=stmt.executeQuery("SELECT COUNT(*) FROM users WHERE username='admin'")){r.next();assertThat(r.getLong(1)).isEqualTo(1);}
     }
    }finally{sql.execute("DROP DATABASE "+schema);}
   }
  }
 }
}
