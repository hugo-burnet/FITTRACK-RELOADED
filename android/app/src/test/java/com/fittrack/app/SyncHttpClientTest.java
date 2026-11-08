package com.fittrack.app;

import okhttp3.Request;
import okhttp3.Response;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.Test;
import java.net.CookieHandler;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

public class SyncHttpClientTest {
    @Test public void ignoresTheGlobalWebViewCookieHandlerForRequestsAndResponses() throws Exception {
        CookieHandler previous = CookieHandler.getDefault();
        AtomicInteger reads = new AtomicInteger(); AtomicInteger writes = new AtomicInteger();
        CookieHandler.setDefault(new CookieHandler() {
            public Map<String, List<String>> get(URI uri, Map<String, List<String>> headers) {
                reads.incrementAndGet(); return Collections.singletonMap("Cookie", Collections.singletonList("webview=must-not-send"));
            }
            public void put(URI uri, Map<String, List<String>> headers) { writes.incrementAndGet(); }
        });
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse().setBody("{}").addHeader("Set-Cookie", "sessionid=private; Secure; HttpOnly; SameSite=Strict"));
            Request request = new Request.Builder().url(server.url("/api/auth/session")).header("Cookie", "sessionid=native-only").build();
            try (Response response = SyncHttpClient.create().newCall(request).execute()) { assertEquals(200, response.code()); }
            assertEquals("sessionid=native-only", server.takeRequest().getHeader("Cookie"));
            assertEquals(0, reads.get()); assertEquals(0, writes.get());
        } finally { CookieHandler.setDefault(previous); }
    }
    @Test public void returnsRedirectsInsteadOfFollowingAnotherOrigin() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse().setResponseCode(302).addHeader("Location", "https://other.invalid/private"));
            try (Response response = SyncHttpClient.create().newCall(new Request.Builder().url(server.url("/api/auth/session")).build()).execute()) {
                assertEquals(302, response.code());
            }
            assertEquals(1, server.getRequestCount());
        }
    }
}
