package com.fittrack.app;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.List;

public class SyncPolicyTest {
    @Test public void originIsHttpsAndHasNoPathCredentialsOrFragment() throws Exception {
        assertEquals("https://fittrack.example:8443", SyncHttpPolicy.origin("https://fittrack.example:8443").toString());
        for (String value : List.of("http://fittrack.example", "https://user:pass@fittrack.example", "https://fittrack.example/extra", "https://fittrack.example#x", "https://fittrack.example?x")) {
            try { SyncHttpPolicy.origin(value); fail(value); } catch (IllegalArgumentException expected) {}
        }
    }
    @Test public void routesAndMethodsAreAnExplicitAllowlist() {
        assertEquals("GET", SyncHttpPolicy.method("/api/auth/session", false));
        assertEquals("POST", SyncHttpPolicy.method("/api/sync/publish", true));
        for (String path : List.of("/admin/", "/api/auth/session?next=x", "/api/../admin/", "https://other.example/api/auth/session")) {
            try { SyncHttpPolicy.method(path, false); fail(path); } catch (IllegalArgumentException expected) {}
        }
        try { SyncHttpPolicy.method("/api/auth/login", false); fail(); } catch (IllegalArgumentException expected) {}
    }
    @Test public void isolatedCookiesRejectOtherDomainsInsecureAndUnexpectedCredentials() {
        SyncCookieJar jar = new SyncCookieJar("fittrack.example");
        String value = "a".repeat(32);
        jar.accept("csrftoken=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict", 1000);
        jar.accept("sessionid=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict; Domain=other.example", 1000);
        jar.accept("sessionid=" + value + "; Path=/; HttpOnly; SameSite=Strict", 1000);
        jar.accept("unexpected=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict", 1000);
        assertEquals("csrftoken=" + value, jar.header(1001));
        assertEquals(value, jar.csrf(1001));
    }
    @Test public void expirationLogoutAndRestoreNeverResurrectExpiredCookies() {
        SyncCookieJar jar = new SyncCookieJar("fittrack.example");
        String value = "a".repeat(32);
        jar.accept("sessionid=" + value + "; Max-Age=2; Path=/; Secure; HttpOnly; SameSite=Strict", 1000);
        assertTrue(jar.header(2999).contains("sessionid"));
        assertEquals("", jar.header(3001));
        jar.accept("csrftoken=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict", 1000);
        jar.accept("csrftoken=; Max-Age=0; Path=/; SameSite=Strict", 1001);
        assertEquals("", jar.header(1002));
        jar.restore("sessionid", value, 999, 1000);
        assertEquals("", jar.header(1002));
    }
}
