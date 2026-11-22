package com.group6.auction.livestream;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import java.sql.*;
import java.nio.file.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
class LiveMysteryMigrationIT {
 @BeforeAll static void isolated(){if(!"true".equals(System.getenv("REGISTRATION_TEST_DATABASE")))throw new IllegalStateException("Isolated DB required");}
 @Test void upgradesPreMysteryLivestreamWithoutChangingExistingRows() throws Exception {
  String base="jdbc:mysql://"+System.getenv("DB_HOST")+":"+System.getenv("DB_PORT")+"/?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC";
  String user=System.getenv("DB_USERNAME"), password=System.getenv("DB_PASSWORD"), schema="mystery_migration_"+UUID.randomUUID().toString().replace("-","");
  try(var connection=DriverManager.getConnection(base,user,password);var sql=connection.createStatement()) {
   sql.execute("CREATE DATABASE "+schema);
   String url=base.replace("/?","/"+schema+"?");
   try {
    try(var c=DriverManager.getConnection(url,user,password);var stmt=c.createStatement()) {
     String source=Files.readString(Path.of("../database/init.sql"));source=source.substring(source.indexOf("CREATE TABLE users"));
     source=source.lines().filter(line -> !line.stripLeading().startsWith("--")).collect(java.util.stream.Collectors.joining("\n"));
     for(String command:source.split(";"))if(!command.isBlank())stmt.execute(command);
    }
    Flyway.configure().dataSource(url,user,password).baselineOnMigrate(true).baselineVersion("0").target("3").load().migrate();
    try(var c=DriverManager.getConnection(url,user,password);var stmt=c.createStatement()) {
     stmt.execute("INSERT INTO livestream_sessions(host_id,create_request_id,title,description,starts_at) SELECT id,'migration-test','Keep title','Keep description',UTC_TIMESTAMP(6) FROM users WHERE role='ADMIN' LIMIT 1");
    }
    Flyway.configure().dataSource(url,user,password).load().migrate();
    try(var c=DriverManager.getConnection(url,user,password);var stmt=c.createStatement();var rs=stmt.executeQuery("SELECT title,description,mystery_enabled,final_state FROM livestream_sessions WHERE create_request_id='migration-test'")) {
     assertThat(rs.next()).isTrue(); assertThat(rs.getString(1)).isEqualTo("Keep title");assertThat(rs.getString(2)).isEqualTo("Keep description");assertThat(rs.getBoolean(3)).isFalse();assertThat(rs.getString(4)).isEqualTo("DISABLED");
    }
   } finally { sql.execute("DROP DATABASE "+schema); }
  }
 }
}
