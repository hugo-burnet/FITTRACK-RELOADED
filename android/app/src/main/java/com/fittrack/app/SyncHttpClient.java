package com.fittrack.app;

import okhttp3.CookieJar;
import okhttp3.OkHttpClient;
import java.util.concurrent.TimeUnit;

final class SyncHttpClient {
    static OkHttpClient create() {
        // URLConnection consults Capacitor's global WebView CookieHandler even
        // when our code supplies its own Cookie header. Use a client that never
        // reads/writes that handler; only SyncCookieJar controls credentials.
        return new OkHttpClient.Builder().cookieJar(CookieJar.NO_COOKIES)
            .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
            .callTimeout(25, TimeUnit.SECONDS).cache(null).build();
    }
}
