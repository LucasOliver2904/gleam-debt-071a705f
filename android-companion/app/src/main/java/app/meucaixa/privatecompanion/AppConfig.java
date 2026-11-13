package app.meucaixa.privatecompanion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.Normalizer;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Configuração local: sem SDK de analytics, sem chave em logs nem em texto claro. */
final class AppConfig {
    private static final String PREFS = "meu_caixa_android_privado";
    private static final String ALIAS = "meu_caixa_android_token_key";
    private static final String ENDPOINT = "https://gleam-debt.lovable.app/api/pix-notificacao";
    private static final String TOKEN = "api_token_aes_gcm";
    private static final String ENABLED = "enabled";
    private static final String BANKS = "bank_apps";
    private static final String HTTP_CODE = "last_http_code";
    private static final String LAST_NOTIFICATION_HASH = "last_notification_hash";
    private static final String LAST_NOTIFICATION_AT = "last_notification_at";

    private AppConfig() {}

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SecretKey encryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) {
            return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return generator.generateKey();
    }

    static boolean setToken(Context c, String raw) {
        String token = raw == null ? "" : raw.trim().toLowerCase(java.util.Locale.ROOT);
        if (!token.matches("[a-f0-9]{64}")) return false;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
            byte[] nonce = cipher.getIV();
            byte[] ciphertext = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            byte[] encrypted = new byte[nonce.length + ciphertext.length];
            System.arraycopy(nonce, 0, encrypted, 0, nonce.length);
            System.arraycopy(ciphertext, 0, encrypted, nonce.length, ciphertext.length);
            return prefs(c).edit().putString(TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit();
        } catch (Exception e) {
            return false;
        }
    }

    static String getToken(Context c) {
        String stored = prefs(c).getString(TOKEN, "");
        if (stored == null || stored.isEmpty()) return null;
        try {
            byte[] bytes = Base64.decode(stored, Base64.NO_WRAP);
            if (bytes.length < 12 + 16) return null;
            byte[] nonce = java.util.Arrays.copyOfRange(bytes, 0, 12);
            byte[] ciphertext = java.util.Arrays.copyOfRange(bytes, 12, bytes.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), new GCMParameterSpec(128, nonce));
            String token = new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
            return token.matches("[a-f0-9]{64}") ? token : null;
        } catch (Exception e) {
            return null;
        }
    }

    static void clearToken(Context c) {
        prefs(c).edit().remove(TOKEN).putBoolean(ENABLED, false).apply();
    }

    static boolean isEnabled(Context c) {
        return prefs(c).getBoolean(ENABLED, false) && getToken(c) != null && !selectedApps(c).isEmpty();
    }

    static void setEnabled(Context c, boolean enabled) {
        prefs(c).edit().putBoolean(ENABLED, enabled).apply();
    }

    static Set<String> selectedApps(Context c) {
        return new HashSet<>(prefs(c).getStringSet(BANKS, Collections.emptySet()));
    }

    static void setSelectedApps(Context c, Set<String> apps) {
        prefs(c).edit().putStringSet(BANKS, new HashSet<>(apps)).apply();
    }

    static void lastHttp(Context c, int code) {
        prefs(c).edit().putInt(HTTP_CODE, code).apply();
    }

    static int lastHttp(Context c) {
        return prefs(c).getInt(HTTP_CODE, 0);
    }

    static boolean isRecentDuplicate(Context c, String hash, long now) {
        return hash.equals(prefs(c).getString(LAST_NOTIFICATION_HASH, "")) &&
            now - prefs(c).getLong(LAST_NOTIFICATION_AT, 0L) < 120_000L;
    }

    static void rememberNotification(Context c, String hash, long now) {
        prefs(c).edit().putString(LAST_NOTIFICATION_HASH, hash).putLong(LAST_NOTIFICATION_AT, now).apply();
    }

    private static String asciiHeader(String value) {
        String simplified = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return simplified.replaceAll("[^a-zA-Z0-9 ._-]", "").trim().substring(0, Math.min(60, simplified.replaceAll("[^a-zA-Z0-9 ._-]", "").trim().length()));
    }

    /** Apenas HTTPs, sem seguir redirecionamento nem mandar credencial em URL. */
    static int request(Context c, boolean test, String titleAndText, String source) {
        String token = getToken(c);
        if (token == null) return 401;
        HttpURLConnection http = null;
        try {
            URL url = new URL(ENDPOINT);
            if (!"https".equals(url.getProtocol()) || !"gleam-debt.lovable.app".equals(url.getHost())) return -1;
            http = (HttpURLConnection) url.openConnection();
            http.setConnectTimeout(12000);
            http.setReadTimeout(12000);
            http.setUseCaches(false);
            http.setInstanceFollowRedirects(false);
            http.setRequestMethod(test ? "GET" : "POST");
            http.setRequestProperty("X-MeuCaixa-Token", token);
            if (!test) {
                byte[] bytes = titleAndText.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > 4000) return 413;
                http.setDoOutput(true);
                http.setRequestProperty("Content-Type", "text/plain; charset=utf-8");
                http.setRequestProperty("X-MeuCaixa-Banco", asciiHeader(source));
                try (OutputStream out = http.getOutputStream()) {
                    out.write(bytes);
                }
            }
            return http.getResponseCode();
        } catch (Exception ignored) {
            return -1;
        } finally {
            if (http != null) http.disconnect();
        }
    }
}
