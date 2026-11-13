package app.meucaixa.privatecompanion;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Companion privado: não embute navegador nem banco.
 * Interface principal do Meu Caixa abre no Chrome (mantém login Google/OAuth).
 */
public final class MainActivity extends Activity {
    private static final int NAVY = Color.rgb(10, 18, 31);
    private static final int CARD = Color.rgb(24, 39, 60);
    private static final int MINT = Color.rgb(70, 235, 178);
    private static final int TEXT = Color.rgb(247, 250, 255);
    private static final int MUTED = Color.rgb(194, 210, 223);
    private LinearLayout content;
    private TextView statusLabel;
    private EditText tokenInput;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(NAVY);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(26), dp(20), dp(36));
        scroll.addView(content);
        setContentView(scroll);

        TextView eyebrow = text("FINANÇAS PESSOAIS / ANDROID", 12, MINT, true);
        content.addView(eyebrow);
        content.addView(gap(8));
        content.addView(text("Meu Caixa", 30, TEXT, true));
        content.addView(gap(4));
        content.addView(text("Captura privada de notificações financeiras", 16, MUTED, false));
        content.addView(gap(18));

        LinearLayout info = panel();
        info.addView(text("Tudo sob seu controle", 18, TEXT, true));
        info.addView(gap(8));
        info.addView(text("Este complemento só envia mensagens de Pix, compras e pagamentos dos aplicativos que VOCÊ escolher. Não faz transferências nem acessa suas senhas bancárias.", 14, MUTED, false));
        content.addView(info);
        content.addView(gap(16));

        statusLabel = text("", 14, TEXT, true);
        content.addView(statusLabel);
        content.addView(gap(12));

        content.addView(text("1 · CHAVE PRIVADA DO MEU CAIXA", 12, MINT, true));
        content.addView(gap(8));
        content.addView(text("Na aba Pix e repasses do site, crie uma chave de integração. Cole-a aqui. Ela será criptografada no Android Keystore e nunca aparecerá novamente.", 13, MUTED, false));
        content.addView(gap(10));
        tokenInput = new EditText(this);
        tokenInput.setSingleLine(true);
        tokenInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        tokenInput.setTextColor(TEXT);
        tokenInput.setHintTextColor(MUTED);
        tokenInput.setHint("Cole a chave privada de 64 caracteres");
        tokenInput.setTextSize(13);
        tokenInput.setPadding(dp(14), 0, dp(14), 0);
        tokenInput.setBackground(round(CARD, 12));
        content.addView(tokenInput, new LinearLayout.LayoutParams(-1, dp(56)));
        content.addView(gap(9));
        addButton("Salvar chave com criptografia", false, () -> {
            if (AppConfig.setToken(this, tokenInput.getText().toString())) {
                tokenInput.setText("");
                toast("Chave protegida no Android.");
                refresh();
            } else {
                toast("A chave deve ter 64 caracteres hexadecimais. Crie-a no Meu Caixa.");
            }
        });
        addButton("Testar conexão HTTPS", true, () -> {
            statusLabel.setText("Testando conexão segura...");
            new Thread(() -> {
                int code = AppConfig.request(this, true, "", "");
                runOnUiThread(() -> {
                    AppConfig.lastHttp(this, code);
                    toast(code == 200 ? "Servidor conectado e chave autorizada." :
                        code == 401 ? "Chave não reconhecida no servidor. Confira a sincronização." :
                        "Conexão não confirmada. Código: " + code);
                    refresh();
                });
            }, "meu-caixa-connectivity-test").start();
        });
        content.addView(gap(20));

        content.addView(text("2 · APLICATIVOS AUTORIZADOS", 12, MINT, true));
        content.addView(gap(8));
        content.addView(text("Selecione somente seus bancos e a Carteira do Google. Não selecione WhatsApp, mensagens ou outros aplicativos pessoais.", 13, MUTED, false));
        content.addView(gap(8));
        addButton("Selecionar bancos e carteira", false, this::chooseApplications);
        content.addView(gap(20));

        content.addView(text("3 · PERMISSÃO DO SISTEMA", 12, MINT, true));
        content.addView(gap(8));
        content.addView(text("O Android controla a permissão de leitura de notificações. Ela é ampla: por segurança, este complemento só processa os apps marcados acima e mensagens com formato financeiro.", 13, MUTED, false));
        content.addView(gap(8));
        addButton("Abrir acesso às notificações", true, () -> {
            try {
                startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (Exception e) {
                toast("Abra Configurações do Android → Acesso especial → Acesso às notificações.");
            }
        });
        content.addView(gap(8));
        content.addView(text("Se o Android bloquear a permissão de um APK instalado manualmente, abra Configurações → Apps → Meu Caixa · Android → ⋮ → Permitir configurações restritas. Só faça isso se você confiar neste instalador privado.", 12, MUTED, false));
        content.addView(gap(20));

        content.addView(text("4 · ATIVAR CAPTURA", 12, MINT, true));
        content.addView(gap(8));
        addButton("Ativar / pausar captura", false, () -> {
            if (AppConfig.isEnabled(this)) {
                AppConfig.setEnabled(this, false);
                toast("Captura pausada.");
            } else {
                if (AppConfig.getToken(this) == null) { toast("Salve sua chave primeiro."); return; }
                if (AppConfig.selectedApps(this).isEmpty()) { toast("Selecione os bancos antes de ativar."); return; }
                if (!listenerGranted()) { toast("Libere a permissão de notificações no Android."); return; }
                AppConfig.setEnabled(this, true);
                toast("Captura ativada. Confira todas as sugestões no Meu Caixa.");
            }
            refresh();
        });
        content.addView(gap(9));
        addButton("Abrir Meu Caixa no navegador", true, () -> {
            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("https://gleam-debt.lovable.app/pix"));
            startActivity(open);
        });
        content.addView(gap(16));
        addButton("Desativar e apagar chave deste Android", true, () ->
            new AlertDialog.Builder(this)
                .setTitle("Desativar captura?")
                .setMessage("A chave criptografada será apagada deste aparelho. Nenhum registro financeiro no Meu Caixa será removido.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Desativar", (dialog, which) -> {
                    AppConfig.clearToken(this);
                    toast("Captura desativada e chave apagada deste Android.");
                    refresh();
                }).show());

        content.addView(gap(24));
        content.addView(text("PRIVACIDADE: nenhuma senha bancária, notificação de aplicativo não selecionado, dados de WhatsApp ou histórico de notificações é transmitido. A mensagem financeira enviada vai para análise no servidor do Meu Caixa e somente entra nos totais depois da sua confirmação.", 12, MUTED, false));
        refresh();
    }

    private void chooseApplications() {
        Intent launch = new Intent(Intent.ACTION_MAIN);
        launch.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> items = getPackageManager().queryIntentActivities(launch, 0);
        Map<String, String> names = new LinkedHashMap<>();
        for (ResolveInfo item : items) {
            if (item.activityInfo == null || item.activityInfo.packageName == null) continue;
            String label = item.loadLabel(getPackageManager()).toString();
            names.put(item.activityInfo.packageName, label);
        }
        List<Map.Entry<String, String>> sorted = new ArrayList<>(names.entrySet());
        sorted.sort(Comparator.comparing(e -> e.getValue().toLowerCase(java.util.Locale.ROOT)));
        if (sorted.isEmpty()) { toast("Não foi possível listar os aplicativos. Verifique o Android."); return; }
        String[] titles = new String[sorted.size()];
        boolean[] checks = new boolean[sorted.size()];
        Set<String> selected = new HashSet<>(AppConfig.selectedApps(this));
        for (int i = 0; i < sorted.size(); i++) {
            Map.Entry<String, String> item = sorted.get(i);
            titles[i] = item.getValue();
            checks[i] = selected.contains(item.getKey());
        }
        new AlertDialog.Builder(this)
            .setTitle("Selecione só bancos e carteira")
            .setMultiChoiceItems(titles, checks, (dialog, which, checked) -> {
                String pkg = sorted.get(which).getKey();
                if (checked) selected.add(pkg);
                else selected.remove(pkg);
            })
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Salvar", (dialog, which) -> {
                AppConfig.setSelectedApps(this, selected);
                toast(selected.size() + " aplicativo(s) autorizado(s).");
                refresh();
            })
            .show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (statusLabel != null) refresh();
    }

    private boolean listenerGranted() {
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        String service = new ComponentName(this, BankNotificationService.class).flattenToString();
        return enabled != null && enabled.contains(service);
    }

    private void refresh() {
        String key = AppConfig.getToken(this) == null ? "Não cadastrada" : "Protegida no Android Keystore";
        String status = AppConfig.isEnabled(this) ? "ATIVA" : "PAUSADA";
        String permission = listenerGranted() ? "Permitida" : "Pendente";
        int code = AppConfig.lastHttp(this);
        statusLabel.setText("Captura: " + status + "\nChave: " + key +
            "\nApps: " + AppConfig.selectedApps(this).size() + " | Permissão: " + permission +
            "\nÚltima resposta HTTP: " + (code == 0 ? "nenhuma" : code == -1 ? "sem conexão" : String.valueOf(code)));
    }

    private LinearLayout panel() {
        LinearLayout p = new LinearLayout(this);
        p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(dp(18), dp(18), dp(18), dp(18));
        p.setBackground(round(CARD, 16));
        return p;
    }

    private GradientDrawable round(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        return d;
    }

    private TextView text(String message, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(message);
        t.setTextSize(size);
        t.setTextColor(color);
        t.setLineSpacing(dp(3), 1f);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }

    private View gap(int dp) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(dp)));
        return v;
    }

    private void addButton(String label, boolean secondary, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(secondary ? TEXT : NAVY);
        button.setBackground(round(secondary ? CARD : MINT, 12));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(51));
        params.bottomMargin = dp(8);
        content.addView(button, params);
        button.setOnClickListener(v -> action.run());
    }

    private int dp(int dp) { return (int) (dp * getResources().getDisplayMetrics().density + 0.5f); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
}
