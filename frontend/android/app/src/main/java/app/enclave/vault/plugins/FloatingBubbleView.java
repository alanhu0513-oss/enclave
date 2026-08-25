package app.enclave.vault.plugins;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.View;

import java.util.Random;

public class FloatingBubbleView extends View {

    private static final float BUBBLE_RADIUS_DP = 28f;
    private static final float BORDER_WIDTH_DP = 1.5f;
    private static final float RING_RADIUS_DP = 32f;
    private static final float RING_STROKE_DP = 0.8f;
    private static final float CROSSHAIR_ARM_DP = 12f;
    private static final float CROSSHAIR_GAP_DP = 4f;
    private static final float CROSSHAIR_STROKE_DP = 0.6f;
    private static final float LABEL_TEXT_SIZE_DP = 5f;
    private static final float HEX_TEXT_SIZE_DP = 4f;

    private final Paint bgPaint;
    private final Paint borderPaint;
    private final Paint ringPaint;
    private final Paint ringArcPaint;
    private final Paint crosshairPaint;
    private final Paint labelPaint;
    private final Paint hexPaint;
    private final Paint dotPaint;

    private float rotation = 0f;
    private float tickerOffset = 0f;
    private final float radius;
    private final float borderWidth;
    private final float ringRadius;
    private final float ringStroke;
    private final float crosshairArm;
    private final float crosshairGap;
    private final float crosshairStroke;
    private final float density;

    private final ValueAnimator spinAnimator;
    private final ValueAnimator tickerAnimator;
    private final Random random = new Random();
    private final char[] hexChars = "0123456789ABCDEF".toCharArray();
    private String hexTicker = "A4 2F 9C 1B 7D 3E 8A 5F";

    public FloatingBubbleView(Context context) {
        super(context);
        this.density = context.getResources().getDisplayMetrics().density;

        radius = BUBBLE_RADIUS_DP * density;
        borderWidth = BORDER_WIDTH_DP * density;
        ringRadius = RING_RADIUS_DP * density;
        ringStroke = RING_STROKE_DP * density;
        crosshairArm = CROSSHAIR_ARM_DP * density;
        crosshairGap = CROSSHAIR_GAP_DP * density;
        crosshairStroke = CROSSHAIR_STROKE_DP * density;

        bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.parseColor("#0A0E12"));
        bgPaint.setStyle(Paint.Style.FILL);

        borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setColor(Color.parseColor("#00E5FF"));
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(borderWidth);
        borderPaint.setAlpha(180);

        ringPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        ringPaint.setColor(Color.parseColor("#00E5FF"));
        ringPaint.setStyle(Paint.Style.STROKE);
        ringPaint.setStrokeWidth(ringStroke);
        ringPaint.setAlpha(35);

        ringArcPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        ringArcPaint.setColor(Color.parseColor("#00E5FF"));
        ringArcPaint.setStyle(Paint.Style.STROKE);
        ringArcPaint.setStrokeWidth(ringStroke * 1.5f);
        ringArcPaint.setAlpha(140);
        ringArcPaint.setStrokeCap(Paint.Cap.ROUND);

        crosshairPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        crosshairPaint.setColor(Color.parseColor("#00E5FF"));
        crosshairPaint.setStyle(Paint.Style.STROKE);
        crosshairPaint.setStrokeWidth(crosshairStroke);
        crosshairPaint.setAlpha(80);

        dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotPaint.setColor(Color.parseColor("#00E5FF"));
        dotPaint.setStyle(Paint.Style.FILL);
        dotPaint.setAlpha(180);

        labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        labelPaint.setColor(Color.parseColor("#00E5FF"));
        labelPaint.setTextSize(LABEL_TEXT_SIZE_DP * density);
        labelPaint.setAlpha(160);
        labelPaint.setTypeface(Typeface.MONOSPACE);
        labelPaint.setTextAlign(Paint.Align.CENTER);

        hexPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        hexPaint.setColor(Color.parseColor("#00E5FF"));
        hexPaint.setTextSize(HEX_TEXT_SIZE_DP * density);
        hexPaint.setAlpha(50);
        hexPaint.setTypeface(Typeface.MONOSPACE);
        hexPaint.setTextAlign(Paint.Align.LEFT);

        spinAnimator = ValueAnimator.ofFloat(0f, 360f);
        spinAnimator.setDuration(4000);
        spinAnimator.setRepeatCount(ValueAnimator.INFINITE);
        spinAnimator.setInterpolator(null);
        spinAnimator.addUpdateListener(anim -> {
            rotation = (float) anim.getAnimatedValue();
            invalidate();
        });

        tickerAnimator = ValueAnimator.ofFloat(0f, 1f);
        tickerAnimator.setDuration(1200);
        tickerAnimator.setRepeatCount(ValueAnimator.INFINITE);
        tickerAnimator.setInterpolator(null);
        tickerAnimator.addUpdateListener(anim -> {
            tickerOffset = (float) anim.getAnimatedValue();
            if (tickerOffset < 0.05f) {
                shuffleHexTicker();
            }
            invalidate();
        });

        setContentDescription("Enclave Shield Active — Tap to deactivate");
    }

    private void shuffleHexTicker() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            sb.append(hexChars[random.nextInt(16)]);
            sb.append(hexChars[random.nextInt(16)]);
            if (i < 7) sb.append(' ');
        }
        hexTicker = sb.toString();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;

        // Outer obsidian disc
        canvas.drawCircle(cx, cy, radius, bgPaint);
        // Ice-blue perimeter
        canvas.drawCircle(cx, cy, radius, borderPaint);

        // Rotating radar sweep arc
        canvas.save();
        canvas.rotate(rotation, cx, cy);
        RectF arcRect = new RectF(cx - ringRadius, cy - ringRadius, cx + ringRadius, cy + ringRadius);
        canvas.drawArc(arcRect, -15f, 50f, false, ringArcPaint);
        // Trailing dash ring
        canvas.drawCircle(cx, cy, ringRadius, ringPaint);
        canvas.restore();

        // Vector crosshair (+)
        canvas.save();
        canvas.rotate(-rotation * 0.5f, cx, cy);
        // Horizontal arm
        canvas.drawLine(cx - crosshairArm, cy, cx - crosshairGap, cy, crosshairPaint);
        canvas.drawLine(cx + crosshairGap, cy, cx + crosshairArm, cy, crosshairPaint);
        // Vertical arm
        canvas.drawLine(cx, cy - crosshairArm, cx, cy - crosshairGap, crosshairPaint);
        canvas.drawLine(cx, cy + crosshairGap, cx, cy + crosshairArm, crosshairPaint);
        canvas.restore();

        // Micro-dot grid — four corner dots
        float dotDist = radius * 0.55f;
        float dotR = 1.2f * density;
        dotPaint.setAlpha(70);
        canvas.drawCircle(cx + dotDist, cy - dotDist, dotR, dotPaint);
        canvas.drawCircle(cx - dotDist, cy - dotDist, dotR, dotPaint);
        canvas.drawCircle(cx + dotDist, cy + dotDist, dotR, dotPaint);
        canvas.drawCircle(cx - dotDist, cy + dotDist, dotR, dotPaint);
        dotPaint.setAlpha(180);

        // Center dot glow
        Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        glowPaint.setColor(Color.parseColor("#00E5FF"));
        glowPaint.setAlpha(25);
        canvas.drawCircle(cx, cy, 4 * density, glowPaint);
        canvas.drawCircle(cx, cy, 1.5f * density, dotPaint);

        // [ENC_CORE_SHIELD] label
        canvas.drawText("[ENC_CORE_SHIELD]", cx, cy + radius + labelPaint.getTextSize() * 1.4f, labelPaint);

        // Scrolling hex ticker around the edge
        float tickerY = cy + radius + labelPaint.getTextSize() * 2.8f;
        float totalHexWidth = hexPaint.measureText(hexTicker);
        float scrollX = cx - totalHexWidth / 2f + tickerOffset * totalHexWidth * 0.3f;
        canvas.save();
        canvas.clipRect(cx - radius * 0.8f, tickerY - hexPaint.getTextSize(), cx + radius * 0.8f, tickerY + hexPaint.getTextSize() * 0.3f);
        canvas.drawText(hexTicker, scrollX, tickerY, hexPaint);
        canvas.drawText(hexTicker, scrollX - totalHexWidth, tickerY, hexPaint);
        canvas.restore();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        float labelH = labelPaint.getTextSize() * 4.5f;
        int size = (int) ((ringRadius + density * 2) * 2);
        int height = (int) (size + labelH);
        setMeasuredDimension(size, height);
    }

    public void startSpin() {
        if (!spinAnimator.isStarted()) {
            spinAnimator.start();
        }
        if (!tickerAnimator.isStarted()) {
            tickerAnimator.start();
        }
    }

    public void stopSpin() {
        if (spinAnimator.isStarted()) {
            spinAnimator.cancel();
        }
        if (tickerAnimator.isStarted()) {
            tickerAnimator.cancel();
        }
    }
}
