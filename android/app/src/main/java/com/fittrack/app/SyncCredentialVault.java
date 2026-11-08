package com.fittrack.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AES key stays in AndroidKeyStore; ciphertext is excluded from OS backup. */
final class SyncCredentialVault {
    private static final String ALIAS = "fittrack-sync-session-v1";
    private final SharedPreferences preferences;
    private final String origin;
    SyncCredentialVault(Context context, String origin) {
        preferences = context.getSharedPreferences("fittrack-sync-vault", Context.MODE_PRIVATE); this.origin = origin;
    }
    static synchronized String installationId(Context context) {
        SharedPreferences preferences = context.getSharedPreferences("fittrack-sync-vault", Context.MODE_PRIVATE);
        String id = preferences.getString("installationId", null);
        if (id == null) {
            id = java.util.UUID.randomUUID().toString();
            if (!preferences.edit().putString("installationId", id).commit()) throw new IllegalStateException("Device identity unavailable");
        }
        return id;
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            return generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    void load(SyncCookieJar jar) throws Exception {
        if (!preferences.contains("ciphertext")) return;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(preferences.getString("iv", ""), Base64.NO_WRAP)));
            cipher.updateAAD(origin.getBytes(StandardCharsets.UTF_8));
            JSONObject value = new JSONObject(new String(cipher.doFinal(Base64.decode(preferences.getString("ciphertext", ""), Base64.NO_WRAP)), StandardCharsets.UTF_8));
            long now = System.currentTimeMillis();
            for (String name : new String[]{"csrftoken", "sessionid"}) {
                JSONObject cookie = value.optJSONObject(name);
                if (cookie != null) jar.restore(name, cookie.getString("value"), cookie.getLong("expiresAt"), now);
            }
        } catch (Exception error) {
            // A reinstallation or device restore has no matching Keystore key.
            jar.clear(); clear();
        }
    }
    void save(SyncCookieJar jar) throws Exception {
        JSONObject value = new JSONObject();
        for (java.util.Map.Entry<String, SyncCookieJar.Entry> entry : jar.snapshot(System.currentTimeMillis()).entrySet()) {
            value.put(entry.getKey(), new JSONObject().put("value", entry.getValue().value).put("expiresAt", entry.getValue().expiresAt));
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(origin.getBytes(StandardCharsets.UTF_8));
        byte[] ciphertext = cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8));
        if (!preferences.edit().putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putString("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP)).commit()) throw new IllegalStateException("Session storage failed");
    }
    void clear() { if (!preferences.edit().remove("iv").remove("ciphertext").commit()) throw new IllegalStateException("Session cleanup failed"); }
}
