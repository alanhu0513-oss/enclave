package app.enclave.vault.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.PixelFormat;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;

import app.enclave.vault.MainActivity;

public class ShieldForegroundService extends Service {

    private static final int NOTIFICATION_ID = 9001;
    private static final String CHANNEL_ID = "enclave_shield_channel";

    private WindowManager windowManager;
    private FloatingBubbleView bubbleView;
    private WindowManager.LayoutParams bubbleParams;
    private boolean active = false;
    private int cloakedCount = 0;
    private int sessionsProtected = 0;

    private int initialX;
    private int initialY;
    private float initialTouchX;
    private float initialTouchY;

    private final BroadcastReceiver deactivateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("ENCLAVE_DEACTIVATE_SHIELDS".equals(intent.getAction())) {
                deactivateAll();
            }
        }
    };

    public class LocalBinder extends Binder {
        public ShieldForegroundService getService() {
            return ShieldForegroundService.this;
        }
    }

    private final IBinder binder = new LocalBinder();

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        registerReceiver(deactivateReceiver, new IntentFilter("ENCLAVE_DEACTIVATE_SHIELDS"),
            RECEIVER_NOT_EXPORTED);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if ("START".equals(action)) {
            startForeground(NOTIFICATION_ID, buildNotification());
            showFloatingBubble();
            active = true;
        } else if ("STOP".equals(action)) {
            hideFloatingBubble();
            active = false;
            stopForeground(true);
            stopSelf();
        } else if ("DEACTIVATE".equals(action) || "ENCLAVE_DEACTIVATE_SHIELDS".equals(action)) {
            deactivateAll();
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    public boolean isActive() {
        return active;
    }

    public int getCloakedCount() {
        return cloakedCount;
    }

    public int getSessionsProtected() {
        return sessionsProtected;
    }

    private void deactivateAll() {
        Intent broadcast = new Intent("ENCLAVE_DEACTIVATE_SHIELDS");
        sendBroadcast(broadcast);

        Intent activityIntent = new Intent(this, MainActivity.class);
        activityIntent.setAction("ENCLAVE_DEACTIVATE_SHIELDS");
        activityIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        activityIntent.putExtra("enclave_deactivate", true);
        activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(activityIntent);
        } catch (Exception ignored) {}

        hideFloatingBubble();
        active = false;
        stopForeground(true);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
        stopSelf();
    }

    private void showFloatingBubble() {
        if (bubbleView != null) return;

        bubbleView = new FloatingBubbleView(this);

        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        bubbleParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = 100;
        bubbleParams.y = 200;

        bubbleView.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    initialX = bubbleParams.x;
                    initialY = bubbleParams.y;
                    initialTouchX = event.getRawX();
                    initialTouchY = event.getRawY();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - initialTouchX;
                    float dy = event.getRawY() - initialTouchY;
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        bubbleParams.x = initialX + (int) dx;
                        bubbleParams.y = initialY + (int) dy;
                        windowManager.updateViewLayout(v, bubbleParams);
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    float totalDx = event.getRawX() - initialTouchX;
                    float totalDy = event.getRawY() - initialTouchY;
                    if (Math.abs(totalDx) < 10 && Math.abs(totalDy) < 10) {
                        deactivateAll();
                    }
                    return true;
            }
            return false;
        });

        try {
            windowManager.addView(bubbleView, bubbleParams);
            bubbleView.startSpin();
        } catch (Exception ignored) {}
    }

    private void hideFloatingBubble() {
        if (bubbleView != null) {
            bubbleView.stopSpin();
            try {
                windowManager.removeView(bubbleView);
            } catch (Exception ignored) {}
            bubbleView = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Enclave Shield",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Persistent notification for Enclave background shield services");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent deactivateIntent = new Intent(this, ShieldForegroundService.class);
        deactivateIntent.setAction("ENCLAVE_DEACTIVATE_SHIELDS");
        PendingIntent deactivatePid = PendingIntent.getService(
            this, 0, deactivateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent openPid = PendingIntent.getActivity(
            this, 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("ENCLAVE // SHIELDS_ACTIVE")
            .setContentText("Camera Immunizer + Voice Shield — Tap for details")
            .setSmallIcon(android.R.drawable.ic_menu_lock)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .setContentIntent(openPid)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "DISABLE", deactivatePid)
            .build();
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(deactivateReceiver);
        } catch (Exception ignored) {}
        hideFloatingBubble();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(NOTIFICATION_ID);
        }
        super.onDestroy();
    }
}
