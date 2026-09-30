package com.group6.auction.account.validation;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class RegistrationInput {
    private RegistrationInput() {}
    public static String username(JsonNode body) {
        return body.path("username").asText("").trim().toLowerCase(Locale.ROOT);
    }
    public static Map<String, String> errors(JsonNode body) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (!body.isObject()) return Map.of("form", "Dữ liệu đăng ký không hợp lệ.");
        body.fieldNames().forEachRemaining(key -> {
            if (!Set.of("username", "password").contains(key)) errors.put("form", "Dữ liệu chứa trường không được phép.");
        });
        if (!body.path("username").isTextual() || !username(body).matches("[a-z0-9._-]{3,50}")) {
            errors.put("username", "Tên đăng nhập cần 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.");
        }
        String password = body.path("password").asText("");
        if (!body.path("password").isTextual() || password.codePointCount(0, password.length()) < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf('\0') >= 0) {
            errors.put("password", "Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte UTF-8.");
        }
        return errors;
    }
}
