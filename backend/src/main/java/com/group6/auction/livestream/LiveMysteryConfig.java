package com.group6.auction.livestream;

import java.util.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Configuration only. Game admission remains disabled until the final-round implementation. */
final class LiveMysteryConfig {
    private LiveMysteryConfig() {}
    static List<LiveInput.Lot> allLots(LiveInput.Create input) {
        var result=new ArrayList<>(input.lots());
        if(input.mystery()!=null) result.add(input.mystery().secretLot());
        return result;
    }
    static void validate(LiveInput.Create input) {
        var mystery=input.mystery();
        if(mystery==null) return;
        if(input.lots().size()<2 || allLots(input).size()>30 || mystery.secretLot()==null ||
                mystery.missions()==null || mystery.missions().isEmpty() || mystery.missions().size()>30)
            throw LiveException.conflict("Cần 2–29 món thường, 1 món bí mật và 1–30 mẫu nhiệm vụ.");
        var ids=new HashSet<>(input.lots().stream().map(LiveInput.Lot::productId).toList());
        if(ids.contains(mystery.secretLot().productId())) throw LiveException.conflict("Món bí mật phải khác các món thường.");
        for(var mission:mystery.missions()) {
            if(mission==null || mission.title()==null || mission.title().isBlank() || mission.title().strip().length()>200 ||
                mission.groupA()==null || mission.groupB()==null || mission.groupA().isEmpty() || mission.groupB().isEmpty() ||
                mission.groupA().size()>29 || mission.groupB().size()>29 ||
                !ids.containsAll(mission.groupA()) || !ids.containsAll(mission.groupB()) ||
                new HashSet<>(mission.groupA()).size()!=mission.groupA().size() ||
                new HashSet<>(mission.groupB()).size()!=mission.groupB().size() ||
                mission.groupA().stream().noneMatch(a -> mission.groupB().stream().anyMatch(b -> !a.equals(b))))
                throw LiveException.conflict("Mỗi nhiệm vụ cần hai nhóm hàng thường ghép được thành hai sản phẩm khác nhau.");
        }
    }
    static String signature(LiveInput.Mystery mystery) {
        if(mystery==null) return null;
        try {
            return new ObjectMapper().configure(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true).writeValueAsString(Map.of(
                "secret",List.of(mystery.secretLot().productId(),mystery.secretLot().startingPrice()),
                "missions",mystery.missions().stream().map(m -> Map.of("title",m.title().strip(),
                    "groupA",m.groupA().stream().sorted().toList(),"groupB",m.groupB().stream().sorted().toList())).toList()));
        } catch(JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}
