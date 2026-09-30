package com.group6.auction.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.group6.auction.account.validation.RegistrationInput;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

class RegistrationInputTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void validatesAndNormalizesUsername() {
        var input = mapper.valueToTree(Map.of("username", "  BaTien  ", "password", "my-password-123"));
        assertThat(RegistrationInput.username(input)).isEqualTo("batien");
        assertThat(RegistrationInput.errors(input)).isEmpty();
    }
    @Test void enforcesUtf8BcryptLimitAndRejectsUnknownFields() {
        assertThat(RegistrationInput.errors(mapper.valueToTree(Map.of("username", "batien", "password", "ầ".repeat(25))))).containsKey("password");
        assertThat(RegistrationInput.errors(mapper.valueToTree(Map.of("username", "batien", "password", "ầ".repeat(24))))).isEmpty();
        assertThat(RegistrationInput.errors(mapper.valueToTree(Map.of("username", "batien", "password", "valid-password", "role", "ADMIN")))).containsKey("form");
        assertThat(RegistrationInput.errors(mapper.createArrayNode())).containsKey("form");
        assertThat(RegistrationInput.errors(mapper.createObjectNode())).containsKeys("username", "password");
    }
}
