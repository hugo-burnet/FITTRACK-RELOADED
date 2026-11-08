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
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

@CapacitorPlugin(name = "FitTrackSync")
public class FitTrackSyncPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicInteger generation = new AtomicInteger();
    private final OkHttpClient http = SyncHttpClient.create();
    private volatile Call active;
    private SyncCookieJar jar;
    private SyncCredentialVault vault;
    @PluginMethod public void info(PluginCall call) {
        try { call.resolve(new JSObject().put("origin", BuildConfig.FITTRACK_SYNC_ORIGIN)
            .put("installationId", SyncCredentialVault.installationId(getContext()))); }
        catch (Exception error) { call.reject("Device identity unavailable"); }
    }
    @PluginMethod public void cancel(PluginCall call) { cancelRequests(); call.resolve(); }
    private void cancelRequests() { generation.incrementAndGet(); Call request = active; if (request != null) request.cancel(); }
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
            Call networkCall = null;
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
                Request.Builder request = new Request.Builder().url(origin.resolve(path).toString())
                    .header("Accept", "application/json").header("Origin", configured)
                    .header("Cache-Control", "no-store").header("Cookie", jar.header(now));
                if (bytes != null) {
                    request.header("X-CSRFToken", jar.csrf(now)).method(method, RequestBody.create(bytes, MediaType.get("application/json; charset=utf-8")));
                } else request.get();
                networkCall = http.newCall(request.build()); active = networkCall;
                if (ticket != generation.get()) throw new IllegalStateException();
                try (Response response = networkCall.execute()) {
                    ResponseBody responseBody = response.body();
                    if (responseBody != null && responseBody.contentLength() > SyncHttpPolicy.MAX_BYTES + 8192L) throw new IllegalArgumentException();
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    if (responseBody != null) try (InputStream stream = responseBody.byteStream()) {
                        byte[] buffer = new byte[8192]; int read;
                        while ((read = stream.read(buffer)) != -1) {
                            if (output.size() + read > SyncHttpPolicy.MAX_BYTES + 8192 || ticket != generation.get()) throw new IllegalStateException();
                            output.write(buffer, 0, read);
                        }
                    }
                    if (ticket != generation.get()) throw new IllegalStateException();
                    for (String header : response.headers("Set-Cookie")) jar.accept(header, System.currentTimeMillis());
                    vault.save(jar);
                    call.resolve(new JSObject().put("status", response.code()).put("body", output.toString(StandardCharsets.UTF_8.name())));
                }
            } catch (Exception error) { call.reject("Sync request unavailable"); }
            finally { if (networkCall != null) networkCall.cancel(); active = null; }
        });
    }
    @Override protected void handleOnDestroy() { cancelRequests(); worker.shutdownNow(); super.handleOnDestroy(); }
}
