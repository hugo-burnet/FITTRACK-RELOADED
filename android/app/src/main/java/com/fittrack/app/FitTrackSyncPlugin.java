package com.fittrack.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "FitTrackSync")
public class FitTrackSyncPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicInteger generation = new AtomicInteger();
    private volatile HttpsURLConnection active;
    private SyncCookieJar jar;
    private SyncCredentialVault vault;
    @PluginMethod public void info(PluginCall call) {
        try { call.resolve(new JSObject().put("origin", BuildConfig.FITTRACK_SYNC_ORIGIN)
            .put("installationId", SyncCredentialVault.installationId(getContext()))); }
        catch (Exception error) { call.reject("Device identity unavailable"); }
    }
    @PluginMethod public void cancel(PluginCall call) { cancelRequests(); call.resolve(); }
    private void cancelRequests() { generation.incrementAndGet(); HttpsURLConnection connection = active; if (connection != null) connection.disconnect(); }
    @PluginMethod public void clear(PluginCall call) {
        cancelRequests();
        worker.execute(() -> { try {
            if (jar != null) jar.clear();
            new SyncCredentialVault(getContext(), BuildConfig.FITTRACK_SYNC_ORIGIN).clear(); call.resolve();
        } catch (Exception error) { call.reject("Session cleanup failed"); } });
    }
    @PluginMethod public void request(PluginCall call) {
        final int ticket = generation.get();
        worker.execute(() -> {
            HttpsURLConnection connection = null;
            try {
                if (ticket != generation.get()) throw new IllegalStateException();
                String configured = BuildConfig.FITTRACK_SYNC_ORIGIN;
                URI origin = SyncHttpPolicy.origin(configured);
                String path = call.getString("path", ""); String body = call.getString("body");
                String method = SyncHttpPolicy.method(path, body != null);
                byte[] bytes = body == null ? null : body.getBytes(StandardCharsets.UTF_8);
                if (bytes != null && bytes.length > SyncHttpPolicy.MAX_BYTES) throw new IllegalArgumentException();
                if (jar == null) { jar = new SyncCookieJar(origin.getHost()); vault = new SyncCredentialVault(getContext(), configured); vault.load(jar); }
                long now = System.currentTimeMillis();
                if (body != null && jar.csrf(now) == null) throw new IllegalStateException();
                connection = (HttpsURLConnection) origin.resolve(path).toURL().openConnection(); active = connection;
                connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
                connection.setConnectTimeout(10000); connection.setReadTimeout(20000); connection.setRequestMethod(method);
                connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Origin", configured);
                connection.setRequestProperty("Cookie", jar.header(now));
                if (bytes != null) {
                    connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("X-CSRFToken", jar.csrf(now));
                    connection.setDoOutput(true); connection.setFixedLengthStreamingMode(bytes.length);
                    try (java.io.OutputStream output = connection.getOutputStream()) { output.write(bytes); }
                }
                int status = connection.getResponseCode();
                if (connection.getContentLengthLong() > SyncHttpPolicy.MAX_BYTES + 8192L) throw new IllegalArgumentException();
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (input != null) try (InputStream stream = input) {
                    byte[] buffer = new byte[8192]; int read;
                    while ((read = stream.read(buffer)) != -1) {
                        if (output.size() + read > SyncHttpPolicy.MAX_BYTES + 8192 || ticket != generation.get()) throw new IllegalStateException();
                        output.write(buffer, 0, read);
                    }
                }
                if (ticket != generation.get()) throw new IllegalStateException();
                for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                    if ("set-cookie".equalsIgnoreCase(header.getKey())) for (String value : header.getValue()) jar.accept(value, System.currentTimeMillis());
                }
                vault.save(jar);
                call.resolve(new JSObject().put("status", status).put("body", output.toString(StandardCharsets.UTF_8.name())));
            } catch (Exception error) { call.reject("Sync request unavailable"); }
            finally { if (connection != null) connection.disconnect(); active = null; }
        });
    }
    @Override protected void handleOnDestroy() { cancelRequests(); worker.shutdownNow(); super.handleOnDestroy(); }
}
