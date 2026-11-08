package com.fittrack.app;

import java.net.HttpCookie;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.Arrays;
import java.util.HashSet;
import java.util.stream.Collectors;

/** Isolated from CookieHandler and WebView: credentials never cross into JavaScript. */
final class SyncCookieJar {
    static final class Entry {
        final String value;
        final long expiresAt;
        Entry(String value, long expiresAt) { this.value = value; this.expiresAt = expiresAt; }
    }
    private static final Set<String> NAMES = new HashSet<>(Arrays.asList("sessionid", "csrftoken"));
    private static final long MAX_AGE = 14 * 24 * 60 * 60;
    private final String host;
    private final Map<String, Entry> cookies = new LinkedHashMap<>();
    SyncCookieJar(String host) { this.host = host; }
    void accept(String header, long now) {
        try {
            for (HttpCookie cookie : HttpCookie.parse(header)) {
                String name = cookie.getName();
                if (!NAMES.contains(name) || (cookie.getDomain() != null && !cookie.getDomain().equalsIgnoreCase(host))
                    || (cookie.getPath() != null && !cookie.getPath().equals("/"))) continue;
                if (cookie.getMaxAge() == 0 || cookie.getValue().isEmpty()) { cookies.remove(name); continue; }
                if (!cookie.getSecure() || !cookie.isHttpOnly()
                    || !header.matches("(?is).*;\\s*SameSite\\s*=\\s*Strict\\s*(?:;.*)?$")) continue;
                long age = cookie.getMaxAge() < 0 ? MAX_AGE : Math.min(MAX_AGE, cookie.getMaxAge());
                restore(name, cookie.getValue(), now + age * 1000, now);
            }
        } catch (IllegalArgumentException ignored) { /* Invalid response cookies grant no authority. */ }
    }
    void restore(String name, String value, long expiresAt, long now) {
        if (NAMES.contains(name) && value.matches("[a-zA-Z0-9]{32,128}") && expiresAt > now
            && expiresAt <= now + MAX_AGE * 1000) cookies.put(name, new Entry(value, expiresAt));
    }
    Map<String, Entry> snapshot(long now) {
        cookies.entrySet().removeIf(entry -> entry.getValue().expiresAt <= now);
        return new LinkedHashMap<>(cookies);
    }
    String header(long now) {
        return snapshot(now).entrySet().stream().map(entry -> entry.getKey() + "=" + entry.getValue().value).collect(Collectors.joining("; "));
    }
    String csrf(long now) { snapshot(now); Entry token = cookies.get("csrftoken"); return token == null ? null : token.value; }
    void clear() { cookies.clear(); }
}
