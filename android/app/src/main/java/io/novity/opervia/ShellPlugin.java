package io.novity.opervia;

import android.graphics.Color;
import android.view.View;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The strip behind the status and navigation bars.
 *
 * Android 15 forces every app edge-to-edge, so MainActivity insets the WebView
 * to keep the topbar clear of the clock and battery. Whatever colour that
 * padding is painted shows through as the strip above the app — and it has to
 * follow the theme, or a dark app gets a white band with white system icons on
 * it, which makes the clock and battery unreadable.
 *
 * StatusBar.setBackgroundColor cannot do this on targetSdk 35: the platform
 * ignores it once edge-to-edge is enforced. Painting the content root is what
 * actually works.
 */
@CapacitorPlugin(name = "NativeShell")
public class ShellPlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        final String color = call.getString("color");
        if (color == null) {
            call.reject("A colour is required.");
            return;
        }
        getActivity()
            .runOnUiThread(() -> {
                try {
                    View content = getActivity().findViewById(android.R.id.content);
                    content.setBackgroundColor(Color.parseColor(color));
                    // The window beneath matters too: a gesture-navigation bar
                    // and the area revealed while over-scrolling both show it.
                    getActivity()
                        .getWindow()
                        .setBackgroundDrawable(
                            new android.graphics.drawable.ColorDrawable(
                                Color.parseColor(color)
                            )
                        );
                    call.resolve();
                } catch (IllegalArgumentException e) {
                    call.reject("That colour could not be parsed.", e);
                }
            });
    }
}
