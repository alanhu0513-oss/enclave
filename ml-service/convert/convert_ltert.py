#!/usr/bin/env python3
"""Convert XceptionNet to LiteRT/TFLite for Android on-device inference.

Usage:
    pip install tensorflow tflite-runtime
    python convert_ltert.py [--output ./output/xceptionnet.tflite] [--quantize]

Outputs:
    - xceptionnet_fp16.tflite  (FP16, ~22 MB, best accuracy)
    - xceptionnet_int8.tflite  (INT8, ~11 MB, fastest on CPU)
"""

import argparse
import os
import sys

def create_xception_model():
    """Create XceptionNet model compatible with TFLite conversion."""
    try:
        import tensorflow as tf
    except ImportError:
        print("Error: TensorFlow not installed. Run: pip install tensorflow")
        sys.exit(1)

    # Try loading from HuggingFace as Keras
    try:
        from transformers import TFAutoModelForImageClassification
        model = TFAutoModelForImageClassification.from_pretrained(
            "redgerd/XceptionNet-Keras",
            from_pt=False,
            trust_remote_code=True
        )
        print("Loaded XceptionNet from HuggingFace (TF)")
        return model
    except Exception as e:
        print(f"HuggingFace TF load failed ({e}), trying tf.keras.applications...")

    # Try tf.keras Xception
    try:
        base = tf.keras.applications.Xception(
            weights='imagenet',
            include_top=False,
            input_shape=(299, 299, 3)
        )
        x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
        x = tf.keras.layers.Dropout(0.5)(x)
        output = tf.keras.layers.Dense(2, activation='softmax', name='predictions')(x)
        model = tf.keras.Model(inputs=base.input, outputs=output)
        print("Created XceptionNet from tf.keras.applications (imagenet pretrained)")
        return model
    except Exception as e:
        print(f"tf.keras.applications failed ({e})")

    # Create from scratch
    try:
        base = tf.keras.applications.Xception(
            weights=None,
            include_top=False,
            input_shape=(299, 299, 3)
        )
        x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
        x = tf.keras.layers.Dropout(0.5)(x)
        output = tf.keras.layers.Dense(2, activation='softmax', name='predictions')(x)
        model = tf.keras.Model(inputs=base.input, outputs=output)
        print("Created untrained XceptionNet (no weights)")
        return model
    except Exception as e:
        print(f"Error creating model: {e}")
        sys.exit(1)


def convert_to_tflite(output_path, quantize=False):
    """Convert XceptionNet to TFLite format."""
    try:
        import tensorflow as tf
    except ImportError:
        print("Error: TensorFlow not installed. Run: pip install tensorflow")
        sys.exit(1)

    model = create_xception_model()

    # Create TFLite converter
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    if quantize:
        # INT8 quantization for maximum speed
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        def representative_dataset():
            for _ in range(100):
                yield [tf.random.normal([1, 299, 299, 3])]
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_types = [tf.int8]
        print("Converting with INT8 quantization...")
    else:
        # FP16 for good accuracy + reasonable size
        converter.target_spec.supported_types = [tf.float16]
        print("Converting with FP16...")

    tflite_model = converter.convert()

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"TFLite model saved: {output_path} ({size_mb:.1f} MB)")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Convert XceptionNet to TFLite")
    parser.add_argument("--output-dir", default="./output",
                        help="Output directory")
    parser.add_argument("--quantize", action="store_true",
                        help="Also produce INT8 quantized model")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    # FP16 model
    fp16_path = os.path.join(args.output_dir, "xceptionnet_fp16.tflite")
    convert_to_tflite(fp16_path, quantize=False)

    # INT8 model
    if args.quantize:
        int8_path = os.path.join(args.output_dir, "xceptionnet_int8.tflite")
        convert_to_tflite(int8_path, quantize=True)


if __name__ == "__main__":
    main()
