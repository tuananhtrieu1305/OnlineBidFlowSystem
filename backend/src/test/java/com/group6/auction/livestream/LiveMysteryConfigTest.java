package com.group6.auction.livestream;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
class LiveMysteryConfigTest {
    LiveInput.Lot lot(long id) { return new LiveInput.Lot(id,"v1","100"); }
    LiveInput.Create input(List<LiveInput.Mission> missions) { return new LiveInput.Create(UUID.randomUUID(),"Demo","",1L,List.of(lot(1),lot(2)),new LiveInput.Mystery(lot(3),missions)); }
    @Test void acceptsOverlappingGroupsWithTwoDifferentProducts() {
        assertThatCode(() -> LiveMysteryConfig.validate(input(List.of(new LiveInput.Mission("Pair",List.of(1L,2L),List.of(1L,2L)))))).doesNotThrowAnyException();
    }
    @Test void rejectsCountingOneProductTwiceAndSecretOrForeignProducts() {
        for(var mission:List.of(new LiveInput.Mission("Pair",List.of(1L),List.of(1L)),new LiveInput.Mission("Pair",List.of(1L),List.of(3L)),new LiveInput.Mission("Pair",List.of(1L),List.of(99L))))
            assertThatThrownBy(() -> LiveMysteryConfig.validate(input(List.of(mission)))).isInstanceOf(LiveException.class);
    }
    @Test void rejectsDuplicateChoicesAndMissingTemplates() {
        assertThatThrownBy(() -> LiveMysteryConfig.validate(input(List.of()))).isInstanceOf(LiveException.class);
        assertThatThrownBy(() -> LiveMysteryConfig.validate(input(List.of(new LiveInput.Mission("Pair",List.of(1L,1L),List.of(2L)))))).isInstanceOf(LiveException.class);
    }
    @Test void rejectsSecretDuplicatingRegularAndTooManyLots() {
        var good=input(List.of(new LiveInput.Mission("Pair",List.of(1L),List.of(2L))));
        assertThatThrownBy(() -> LiveMysteryConfig.validate(new LiveInput.Create(good.requestId(),good.title(),good.description(),good.startsAt(),good.lots(),new LiveInput.Mystery(lot(1),good.mystery().missions())))).isInstanceOf(LiveException.class);
        var many=java.util.stream.LongStream.rangeClosed(1,30).mapToObj(this::lot).toList();
        assertThatThrownBy(() -> LiveMysteryConfig.validate(new LiveInput.Create(good.requestId(),good.title(),good.description(),good.startsAt(),many,new LiveInput.Mystery(lot(31),good.mystery().missions())))).isInstanceOf(LiveException.class);
    }
    @Test void readsCanonicalJsonWithOptionalMystery() throws Exception {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var input=input(List.of(new LiveInput.Mission("Pair",List.of(1L),List.of(2L))));
        assertThat(mapper.readValue(mapper.writeValueAsString(input),LiveInput.Create.class)).isEqualTo(input);
    }
    @Test void preservesLegacyInput() {
        var legacy=new LiveInput.Create(UUID.randomUUID(),"Old","",1L,List.of(lot(1)));
        assertThatCode(() -> LiveMysteryConfig.validate(legacy)).doesNotThrowAnyException();
        assertThat(LiveMysteryConfig.signature(legacy.mystery())).isNull();
        assertThat(LiveMysteryConfig.allLots(legacy)).hasSize(1);
    }
}
