package com.group6.auction.livestream;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public final class LiveInput {
    private LiveInput() {}
    public record Lot(@NotNull @Positive Long productId, @NotBlank @Size(max=66) String productVersion, @NotBlank @Size(max=19) String startingPrice) {}
    public record Mission(@NotBlank @Size(max=200) String title,
                          @NotEmpty @Size(max=29) List<@NotNull @Positive Long> groupA,
                          @NotEmpty @Size(max=29) List<@NotNull @Positive Long> groupB) {}
    public record Mystery(@NotNull @Valid Lot secretLot, @NotEmpty @Size(max=30) List<@NotNull @Valid Mission> missions) {}
    public record Create(@NotNull UUID requestId, @NotBlank @Size(max=120) String title,
                         @NotNull @Size(max=1000) String description, @NotNull @Min(1) @Max(253402300799999L) Long startsAt,
                         @NotEmpty @Size(max=30) List<@NotNull @Valid Lot> lots, @Valid Mystery mystery) {
        public Create(UUID requestId, String title, String description, Long startsAt, List<Lot> lots) {
            this(requestId,title,description,startsAt,lots,null);
        }
    }
    public record Bid(@NotNull UUID requestId, @NotBlank String amount) {}
    public record Command(@NotNull UUID requestId, @Positive Long lotId) {}
    public record Registration(boolean registered) {}
    public record Chat(@NotNull UUID requestId, @NotBlank @Size(max=500) String text) {}
}
