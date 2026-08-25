#!/usr/bin/env python3
"""Convert XceptionNet to Core ML (.mlpackage) for iOS on-device inference.

Usage:
    pip install coremltools torch torchvision
    python convert_coreml.py [--output ./output/xceptionnet.mlpackage]

Input: XceptionNet weights (PyTorch checkpoint or HuggingFace)
Output: .mlpackage directory (Core ML model)
"""

import argparse
import os
import sys
import tempfile

def create_xception_model():
    """Create XceptionNet model compatible with Core ML conversion."""
    try:
        import torch
        import torch.nn as nn
    except ImportError:
        print("Error: PyTorch not installed. Run: pip install torch torchvision")
        sys.exit(1)

    # Try loading from HuggingFace first
    try:
        from transformers import AutoModelForImageClassification
        model = AutoModelForImageClassification.from_pretrained(
            "redgerd/XceptionNet-Keras",
            trust_remote_code=True
        )
        print("Loaded XceptionNet from HuggingFace")
        return model
    except Exception as e:
        print(f"HuggingFace load failed ({e}), trying timm...")

    # Fallback: timm
    try:
        import timm
        model = timm.create_model('xception', pretrained=True, num_classes=2)
        print("Loaded XceptionNet from timm")
        return model
    except Exception as e:
        print(f"timm load failed ({e}), creating untrained model...")

    # Last resort: create untrained model
    try:
        import timm
        model = timm.create_model('xception', pretrained=False, num_classes=2)
        print("Created untrained XceptionNet (no weights)")
        return model
    except ImportError:
        print("Error: timm not installed. Run: pip install timm")
        sys.exit(1)


def convert_to_coreml(output_path):
    """Convert XceptionNet to Core ML format."""
    try:
        import coremltools as ct
        import torch
    except ImportError:
        print("Error: coremltools not installed. Run: pip install coremltools")
        sys.exit(1)

    model = create_xception_model()
    model.eval()

    # Create dummy input (1, 3, 299, 299) for XceptionNet
    dummy_input = torch.randn(1, 3, 299, 299)

    # Trace the model
    print("Tracing model...")
    with torch.no_grad():
        traced_model = torch.jit.trace(model, dummy_input)

    # Convert to Core ML
    print("Converting to Core ML...")
    mlmodel = ct.convert(
        traced_model,
        inputs=[ct.ImageType(
            name="image",
            shape=(1, 3, 299, 299),
            scale=1.0 / 255.0,
            bias=[-0.5, -0.5, -0.5],
        )],
        outputs=[ct.TensorType(name="predictions")],
        classifier_config=ct.ClassifierConfig(["real", "fake"]),
        minimum_deployment_target=ct.target.iOS15,
        compute_precision=ct.precision.FLOAT16,
    )

    # Set model metadata
    mlmodel.author = "Enclave"
    mlmodel.short_description = "XceptionNet deepfake image detector"
    mlmodel.version = "1.0"

    # Save
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    mlmodel.save(output_path)
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Core ML model saved: {output_path} ({size_mb:.1f} MB)")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Convert XceptionNet to Core ML")
    parser.add_argument("--output", default="./output/xceptionnet.mlpackage",
                        help="Output path for .mlpackage")
    args = parser.parse_args()
    convert_to_coreml(args.output)


if __name__ == "__main__":
    main()
