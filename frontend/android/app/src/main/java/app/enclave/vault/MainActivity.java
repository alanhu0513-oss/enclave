package app.enclave.vault;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleDeactivateIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleDeactivateIntent(intent);
    }

    private void handleDeactivateIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("enclave_deactivate", false)) {
            try {
                bridge.eval("(function(){" +
                    "if(window.EnclaveNative&&window.EnclaveNative.shieldOverlay){" +
                    "window.EnclaveNative.shieldOverlay.deactivateAll();" +
                    "}})()");
            } catch (Exception ignored) {}
        }
    }
}
