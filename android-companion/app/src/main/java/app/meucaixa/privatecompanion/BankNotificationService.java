package app.meucaixa.privatecompanion;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Só envia notificações financeiras dos aplicativos explicitamente marcados pelo proprietário. */
public final class BankNotificationService extends NotificationListenerService {
    private final ExecutorService sender = Executors.newSingleThreadExecutor();

    @Override
    public void onNotificationPosted(StatusBarNotification posted) {
        if (posted == null || posted.getPackageName() == null || !AppConfig.isEnabled(this)) return;
        final String packageName = posted.getPackageName();
        if (!AppConfig.selectedApps(this).contains(packageName)) return;
        Notification notification = posted.getNotification();
        if (notification == null || (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
        Bundle data = notification.extras;
        if (data == null) return;
        String title = String.valueOf(data.getCharSequence(Notification.EXTRA_TITLE, ""));
        CharSequence big = data.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String body = String.valueOf(big == null ? data.getCharSequence(Notification.EXTRA_TEXT, "") : big);
        String message = (title + "\n" + body).trim();
        if (!isPermittedFinancialNotice(message)) return;

        final String source = applicationName(packageName);
        final String signature = sha256(packageName + "\n" + message.trim().toLowerCase(Locale.ROOT));
        if (signature == null || AppConfig.isRecentDuplicate(this, signature, System.currentTimeMillis())) return;
        sender.execute(() -> {
            long now = System.currentTimeMillis();
            if (AppConfig.isRecentDuplicate(this, signature, now)) return;
            int status = AppConfig.request(this, false, message, source);
            AppConfig.lastHttp(this, status);
            if (status == 202 || status == 200) AppConfig.rememberNotification(this, signature, now);
        });
    }

    private String applicationName(String packageName) {
        try {
            ApplicationInfo info = getPackageManager().getApplicationInfo(packageName, 0);
            return getPackageManager().getApplicationLabel(info).toString();
        } catch (Exception ignored) {
            return packageName;
        }
    }

    private boolean isPermittedFinancialNotice(String raw) {
        if (raw.length() < 10 || raw.length() > 3000) return false;
        String text = raw.toLowerCase(Locale.ROOT);
        if (!text.contains("r$")) return false;
        if (!(text.contains("pix") || text.contains("compra") || text.contains("pagamento") ||
              text.contains("cartão") || text.contains("cartao") || text.contains("transação") ||
              text.contains("transacao") || text.contains("aprovada") ||
              text.contains("recebeu") || text.contains("recebido"))) return false;
        // Rejeitar avisos sobre autenticação, senhas e códigos antes de qualquer envio.
        return !(text.contains("código") || text.contains("codigo") || text.contains("senha") ||
            text.contains("token") || text.contains("autenticação") ||
            text.contains("autenticacao") || text.contains("verificação") ||
            text.contains("verificacao") || text.contains("otp"));
    }

    private String sha256(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder s = new StringBuilder();
            for (byte value : digest) s.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            return s.toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    @Override
    public void onDestroy() {
        sender.shutdown();
        super.onDestroy();
    }
}
