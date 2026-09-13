package io.novity.opervia;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Opervia's own bridge to Android's PrintManager. Must be registered
        // before super.onCreate() or the WebView will not see it.
        registerPlugin(PrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
