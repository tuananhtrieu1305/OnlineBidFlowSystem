package com.group6.auction.config;
import org.springframework.context.annotation.*;
import java.time.Clock;
@Configuration
public class TimeConfig {
 @Bean public Clock applicationClock(){return Clock.systemUTC();}
}
