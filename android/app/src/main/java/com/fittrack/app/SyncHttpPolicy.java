package com.fittrack.app;

import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

final class SyncHttpPolicy {
    static final int MAX_BYTES = 16 * 1024 * 1024;
    private static final Set<String> READS = new HashSet<>(Arrays.asList("/api/auth/session", "/api/sync/state"));
    private static final Set<String> WRITES = new HashSet<>(Arrays.asList("/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/sync/publish"));
    static URI origin(String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()) || uri.getQuery() != null
                || uri.getFragment() != null || uri.getPort() == 0 || uri.getPort() > 65535) throw new IllegalArgumentException();
            return uri;
        } catch (Exception error) { throw new IllegalArgumentException("Unavailable sync origin"); }
    }
    static String method(String path, boolean body) {
        if (!body && READS.contains(path)) return "GET";
        if (body && WRITES.contains(path)) return "POST";
        throw new IllegalArgumentException("Unsupported sync route");
    }
}
