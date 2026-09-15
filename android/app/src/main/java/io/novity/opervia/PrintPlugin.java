package io.novity.opervia;

import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android's WebView does not implement window.print(), and the printed A4
 * invoice is what Opervia exists to produce. Rather than depend on an
 * unmaintained third-party plugin for the product's core deliverable, this
 * bridges directly to the platform PrintManager using the documented
 * WebView.createPrintDocumentAdapter path.
 *
 * The system print sheet it opens includes "Save as PDF", so the same action
 * covers both printing and sending a PDF to a customer. The page already
 * carries @media print rules and @page { size: A4 }, so the output matches the
 * browser's exactly.
 *
 * The call does not resolve when the sheet opens; it resolves when the job it
 * created settles. Without that the app can only say "we opened a dialog",
 * which is not something worth telling anyone — whereas "saved" is, and it has
 * to be true.
 */
@CapacitorPlugin(name = "NativePrint")
public class PrintPlugin extends Plugin {

    /** How often the spooler is asked where the job got to. */
    private static final long POLL_MS = 400;
    /** Give up after two minutes rather than poll behind a forgotten dialog. */
    private static final int MAX_POLLS = 300;

    @PluginMethod
    public void print(PluginCall call) {
        final String name = call.getString("name", "Opervia invoice");

        // PrintManager must be driven from the UI thread, and the adapter has
        // to come from the live WebView so it prints what the user is seeing.
        getActivity()
            .runOnUiThread(() -> {
                try {
                    WebView webView = getBridge().getWebView();
                    PrintManager printManager = (PrintManager) getActivity()
                        .getSystemService(android.content.Context.PRINT_SERVICE);

                    if (printManager == null) {
                        call.reject("Printing is not available on this device.");
                        return;
                    }

                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);

                    PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();

                    PrintJob job = printManager.print(name, adapter, attributes);
                    watch(call, job, 0);
                } catch (Exception e) {
                    call.reject("Could not open the print dialog.", e);
                }
            });
    }

    /**
     * Follows one print job to its end. The spooler exposes no completion
     * callback, so the state is polled — cheaply, and only while a job the user
     * started is still open.
     */
    private void watch(PluginCall call, PrintJob job, int polls) {
        if (job == null) {
            settle(call, "unknown");
            return;
        }
        if (job.isCompleted()) {
            settle(call, "completed");
            return;
        }
        if (job.isCancelled()) {
            settle(call, "cancelled");
            return;
        }
        if (job.isFailed() || job.isBlocked()) {
            settle(call, "failed");
            return;
        }
        if (polls >= MAX_POLLS) {
            settle(call, "unknown");
            return;
        }
        new Handler(Looper.getMainLooper())
            .postDelayed(() -> watch(call, job, polls + 1), POLL_MS);
    }

    private void settle(PluginCall call, String status) {
        JSObject result = new JSObject();
        result.put("status", status);
        call.resolve(result);
    }
}
