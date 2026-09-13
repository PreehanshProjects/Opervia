package io.novity.opervia;

import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

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
 */
@CapacitorPlugin(name = "NativePrint")
public class PrintPlugin extends Plugin {

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

                    printManager.print(name, adapter, attributes);
                    call.resolve();
                } catch (Exception e) {
                    call.reject("Could not open the print dialog.", e);
                }
            });
    }
}
