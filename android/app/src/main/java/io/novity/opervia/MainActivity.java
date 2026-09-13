package io.novity.opervia;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Opervia's own bridge to Android's PrintManager. Must be registered
        // before super.onCreate() or the WebView will not see it.
        registerPlugin(PrintPlugin.class);
        super.onCreate(savedInstanceState);

        // Android 15 (targetSdk 35) forces every app edge-to-edge, so the WebView
        // is laid out behind the status and navigation bars. Left alone, the
        // topbar renders underneath the clock and battery — and because the page
        // scrolls, padding the topbar in CSS would only fix it at scroll zero.
        //
        // Insetting the content root instead keeps the whole WebView clear of the
        // system bars at every scroll position, on every Android version.
        final View content = findViewById(android.R.id.content);
        content.setBackgroundColor(Color.parseColor("#F7F8F5")); // Paper
        ViewCompat.setOnApplyWindowInsetsListener(
            content,
            (view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() |
                    WindowInsetsCompat.Type.displayCutout()
                );
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                // Deliberately NOT consumed: the keyboard inset must still reach
                // Capacitor's Keyboard plugin or the invoice form stops resizing
                // when the keyboard opens. The CSS side avoids padding twice via
                // the .is-native class instead.
                return windowInsets;
            }
        );
    }
}
