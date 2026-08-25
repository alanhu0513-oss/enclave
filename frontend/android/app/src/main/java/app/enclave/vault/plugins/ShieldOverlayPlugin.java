package app.enclave.vault.plugins;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShieldOverlay")
public class ShieldOverlayPlugin extends Plugin {

    private ShieldForegroundService shieldService;
    private boolean serviceBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            ShieldForegroundService.LocalBinder binder = (ShieldForegroundService.LocalBinder) service;
            shieldService = binder.getService();
            serviceBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            serviceBound = false;
            shieldService = null;
        }
    };

    @PluginMethod
    public void start(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity context");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(activity)) {
                JSObject ret = new JSObject();
                ret.put("requiresPermission", true);
                call.resolve(ret);
                return;
            }
        }

        Intent intent = new Intent(activity, ShieldForegroundService.class);
        intent.setAction("START");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.startForegroundService(intent);
        } else {
            activity.startService(intent);
        }
        activity.bindService(intent, connection, Context.BIND_AUTO_CREATE);

        JSObject ret = new JSObject();
        ret.put("active", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null && serviceBound) {
            try {
                activity.unbindService(connection);
            } catch (IllegalArgumentException ignored) {}
            serviceBound = false;
            Intent intent = new Intent(activity, ShieldForegroundService.class);
            intent.setAction("STOP");
            activity.startService(intent);
        }
        JSObject ret = new JSObject();
        ret.put("active", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", shieldService != null && shieldService.isActive());
        ret.put("cloakedCount", shieldService != null ? shieldService.getCloakedCount() : 0);
        ret.put("sessionsProtected", shieldService != null ? shieldService.getSessionsProtected() : 0);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(activity)) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:" + activity.getPackageName())
            );
            activity.startActivity(intent);
        }
        call.resolve();
    }
}
