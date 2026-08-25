package app.enclave.vault.plugins;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.gpu.GpuDelegate;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;

@CapacitorPlugin(name = "OnDeviceML")
public class OnDeviceMLPlugin extends Plugin {

    private Interpreter interpreter;
    private boolean modelLoaded = false;
    private GpuDelegate gpuDelegate;

    private static final int INPUT_SIZE = 299;
    private static final int NUM_CHANNELS = 3;

    @PluginMethod
    public void loadModel(PluginCall call) {
        String modelName = call.getString("modelName", "xceptionnet");

        try {
            File modelFile = new File(getContext().getFilesDir(), modelName + ".tflite");
            if (!modelFile.exists()) {
                // Try assets
                modelFile = new File(getContext().getFilesDir(), "models/" + modelName + ".tflite");
            }

            if (!modelFile.exists()) {
                // Try raw resources
                int resId = getContext().getResources().getIdentifier(
                    modelName, "raw", getContext().getPackageName());
                if (resId != 0) {
                    MappedByteBuffer buffer = loadModelFromRaw(resId);
                    Interpreter.Options options = new Interpreter.Options();
                    options.setNumThreads(4);
                    interpreter = new Interpreter(buffer, options);
                    modelLoaded = true;
                    call.resolve(buildResult("loaded", true));
                    return;
                }
                call.reject("Model not found: " + modelName);
                return;
            }

            MappedByteBuffer buffer = loadModelFromFile(modelFile);
            Interpreter.Options options = new Interpreter.Options();
            options.setNumThreads(4);

            // Try GPU delegate for faster inference
            try {
                gpuDelegate = new GpuDelegate();
                options.addDelegate(gpuDelegate);
            } catch (Exception e) {
                // GPU not available, use CPU
            }

            interpreter = new Interpreter(buffer, options);
            modelLoaded = true;
            call.resolve(buildResult("loaded", true));

        } catch (Exception e) {
            call.reject("Failed to load model: " + e.getMessage());
        }
    }

    @PluginMethod
    public void classify(PluginCall call) {
        if (!modelLoaded || interpreter == null) {
            call.reject("Model not loaded. Call loadModel first.");
            return;
        }

        String imageBase64 = call.getString("image");
        if (imageBase64 == null) {
            call.reject("Image base64 required");
            return;
        }

        try {
            byte[] imageBytes = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            if (bitmap == null) {
                call.reject("Invalid image data");
                return;
            }

            float[][] output = new float[1][2];
            ByteBuffer inputBuffer = preprocessImage(bitmap);
            interpreter.run(inputBuffer, output);

            float fakeProb = output[0][1]; // Index 1 = fake class
            float realProb = output[0][0]; // Index 0 = real class

            String verdict;
            if (fakeProb > 0.6f) {
                verdict = "LIKELY_SYNTHETIC";
            } else if (fakeProb > 0.35f) {
                verdict = "SUSPICIOUS";
            } else {
                verdict = "LIKELY_NATURAL";
            }

            JSObject result = new JSObject();
            result.put("confidence", Math.round(fakeProb * 1000) / 10.0);
            result.put("verdict", verdict);
            result.put("realProb", realProb);
            result.put("fakeProb", fakeProb);
            result.put("source", "on_device_ltert");
            result.put("computeUnits", gpuDelegate != null ? "gpu" : "cpu");
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Classification failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("platform", "android");
        result.put("framework", "ltert");
        result.put("hasNNAPI", hasNNAPI());
        result.put("modelLoaded", modelLoaded);
        result.put("computeUnits", gpuDelegate != null ? "gpu" : "cpu");
        call.resolve(result);
    }

    @PluginMethod
    public void classifyFromUrl(PluginCall call) {
        if (!modelLoaded || interpreter == null) {
            call.reject("Model not loaded. Call loadModel first.");
            return;
        }

        String urlString = call.getString("url");
        if (urlString == null) {
            call.reject("URL required");
            return;
        }

        // Run network request on background thread
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL(urlString);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                java.io.InputStream is = conn.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(is);
                conn.disconnect();

                if (bitmap == null) {
                    call.reject("Failed to decode image from URL");
                    return;
                }

                float[][] output = new float[1][2];
                ByteBuffer inputBuffer = preprocessImage(bitmap);
                interpreter.run(inputBuffer, output);

                float fakeProb = output[0][1];
                String verdict;
                if (fakeProb > 0.6f) verdict = "LIKELY_SYNTHETIC";
                else if (fakeProb > 0.35f) verdict = "SUSPICIOUS";
                else verdict = "LIKELY_NATURAL";

                JSObject result = new JSObject();
                result.put("confidence", Math.round(fakeProb * 1000) / 10.0);
                result.put("verdict", verdict);
                result.put("source", "on_device_ltert");
                call.resolve(result);

            } catch (Exception e) {
                call.reject("URL classification failed: " + e.getMessage());
            }
        }).start();
    }

    private ByteBuffer preprocessImage(Bitmap bitmap) {
        Bitmap resized = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true);
        ByteBuffer buffer = ByteBuffer.allocateDirect(1 * INPUT_SIZE * INPUT_SIZE * NUM_CHANNELS * 4);
        buffer.order(ByteOrder.nativeOrder());

        int[] pixels = new int[INPUT_SIZE * INPUT_SIZE];
        resized.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE);

        for (int pixel : pixels) {
            // XceptionNet normalization: [-1, 1]
            buffer.putFloat(((pixel >> 16) & 0xFF) / 127.5f - 1.0f);
            buffer.putFloat(((pixel >> 8) & 0xFF) / 127.5f - 1.0f);
            buffer.putFloat((pixel & 0xFF) / 127.5f - 1.0f);
        }

        resized.recycle();
        return buffer;
    }

    private MappedByteBuffer loadModelFromFile(File file) throws IOException {
        FileInputStream fis = new FileInputStream(file);
        FileChannel channel = fis.getChannel();
        return channel.map(FileChannel.MapMode.READ_ONLY, 0, channel.size());
    }

    private MappedByteBuffer loadModelFromRaw(int resId) throws IOException {
        FileInputStream fis = new FileInputStream(getContext().getResources().openRawResource(resId));
        FileChannel channel = fis.getChannel();
        return channel.map(FileChannel.MapMode.READ_ONLY, 0, channel.size());
    }

    private boolean hasNNAPI() {
        try {
            // NNAPI is available on Android 8.1+ (API 27+)
            return android.os.Build.VERSION.SDK_INT >= 27;
        } catch (Exception e) {
            return false;
        }
    }

    private JSObject buildResult(String key, Object value) {
        JSObject result = new JSObject();
        result.put(key, value);
        result.put("modelName", "xceptionnet");
        return result;
    }

    @Override
    protected void handleOnDestroy() {
        if (interpreter != null) {
            interpreter.close();
        }
        if (gpuDelegate != null) {
            gpuDelegate.close();
        }
    }
}
