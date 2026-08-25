"""Enclave ML Detection Service — Full deepfake detection pipeline.

Endpoints:
  POST /detect/image    — Image deepfake detection (MTCNN face extraction + XceptionNet)
  POST /detect/audio    — Audio deepfake detection (Librosa spectral analysis)
  POST /face/match      — Compare two faces for identity match
  GET  /health          — Service health + loaded models
  POST /models/download — Trigger model download (admin)
"""

import os
import io
import json
import hashlib
import tempfile
import logging
from pathlib import Path
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse

logger = logging.getLogger("enclave-ml")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "info"))

app = FastAPI(title="Enclave ML Service", version="2.0.0")

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "/models"))
UPLOAD_DIR = MODEL_DIR / "uploads" / "temp"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_models = {}
_face_cascade = None


# ─────────────────────────────────────────────
# Model Loading
# ─────────────────────────────────────────────

def _load_onnx_model(name: str):
    """Lazy-load an ONNX model."""
    if name in _models:
        return _models[name]
    model_path = MODEL_DIR / f"{name}.onnx"
    if not model_path.exists():
        logger.warning(f"Model not found: {model_path}")
        return None
    try:
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 2
        opts.intra_op_num_threads = 4
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session = ort.InferenceSession(str(model_path), opts)
        _models[name] = session
        logger.info(f"Loaded model: {name} | inputs: {[i.name for i in session.get_inputs()]}")
        return session
    except Exception as e:
        logger.error(f"Failed to load model {name}: {e}")
        return None


def _get_mtcnn():
    """Lazy-load MTCNN face detector."""
    global _face_cascade
    if _face_cascade is not None:
        return _face_cascade
    try:
        from mtcnn import MTCNN
        _face_cascade = MTCNN(
            thresholds=[0.6, 0.7, 0.7],
            factor=0.709,
            min_face_size=20,
        )
        logger.info("MTCNN face detector loaded")
        return _face_cascade
    except Exception as e:
        logger.warning(f"MTCNN load failed: {e}")
        return None


def _get_face_recognition():
    """Check if face_recognition library is available."""
    try:
        import face_recognition
        return face_recognition
    except ImportError:
        logger.warning("face_recognition not available")
        return None


# ─────────────────────────────────────────────
# Image Preprocessing
# ─────────────────────────────────────────────

def _load_image_as_rgb(image_bytes: bytes):
    """Load image bytes as RGB numpy array."""
    from PIL import Image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(img)


def _extract_faces_mtcnn(image_bytes: bytes) -> List[dict]:
    """Extract faces from image using MTCNN. Returns list of face dicts with bbox and cropped image."""
    rgb = _load_image_as_rgb(image_bytes)
    detector = _get_mtcnn()
    if detector is None:
        return []

    try:
        detections = detector.detect_faces(rgb)
    except Exception as e:
        logger.warning(f"MTCNN detection failed: {e}")
        return []

    faces = []
    h, w = rgb.shape[:2]
    for det in detections:
        x, y, bw, bh = det["box"]
        conf = det["confidence"]
        if conf < 0.90:
            continue
        # Clamp to image bounds
        x1 = max(0, x)
        y1 = max(0, y)
        x2 = min(w, x + bw)
        y2 = min(h, y + bh)
        # Add margin (20%)
        margin_x = int((x2 - x1) * 0.2)
        margin_y = int((y2 - y1) * 0.2)
        x1 = max(0, x1 - margin_x)
        y1 = max(0, y1 - margin_y)
        x2 = min(w, x2 + margin_x)
        y2 = min(h, y2 + margin_y)

        cropped = rgb[y1:y2, x1:x2]
        if cropped.size == 0:
            continue
        faces.append({
            "bbox": [int(x1), int(y1), int(x2), int(y2)],
            "confidence": float(conf),
            "cropped_rgb": cropped,
            "landmarks": det.get("keypoints", {}),
        })
    return faces


def _preprocess_for_xception(image_array: np.ndarray, target_size=(299, 299)) -> Optional[np.ndarray]:
    """Preprocess image for XceptionNet: resize to 299x299, normalize to [-1, 1]."""
    from PIL import Image
    try:
        img = Image.fromarray(image_array).resize(target_size, Image.BILINEAR)
        arr = np.array(img, dtype=np.float32)
        # XceptionNet normalization: [-1, 1]
        arr = (arr / 127.5) - 1.0
        # HWC → CHW → NCHW
        arr = np.transpose(arr, (2, 0, 1))
        arr = np.expand_dims(arr, 0)
        return arr
    except Exception as e:
        logger.error(f"Xception preprocess failed: {e}")
        return None


# ─────────────────────────────────────────────
# Heuristic Analysis
# ─────────────────────────────────────────────

def _heuristic_analysis(image_bytes: bytes) -> dict:
    """Pure heuristic analysis — no model needed."""
    try:
        rgb = _load_image_as_rgb(image_bytes)
        gray = 0.299 * rgb[:, :, 0].astype(np.float64) + 0.587 * rgb[:, :, 1].astype(np.float64) + 0.114 * rgb[:, :, 2].astype(np.float64)

        # High-frequency noise (Laplacian)
        if gray.shape[0] > 2 and gray.shape[1] > 2:
            lap = np.abs(
                4 * gray[1:-1, 1:-1]
                - gray[:-2, 1:-1]
                - gray[2:, 1:-1]
                - gray[1:-1, :-2]
                - gray[1:-1, 2:]
            )
            hf_noise = float(np.mean(lap) / (np.mean(gray) + 1e-6))
        else:
            hf_noise = 0.5

        # Local variance (8x8 blocks)
        h, w = gray.shape
        block_size = 8
        variances = []
        for by in range(0, h - block_size, block_size):
            for bx in range(0, w - block_size, block_size):
                block = gray[by:by+block_size, bx:bx+block_size]
                variances.append(float(np.var(block)))
        avg_var = float(np.mean(variances)) if variances else 0

        # Edge coherence
        gx = np.abs(np.diff(gray, axis=1))
        strong_edges = int(np.sum(gx > 80))
        total_edges = int(np.sum(gx > 30))
        edge_ratio = strong_edges / (total_edges + 1)

        # Color channel correlation anomaly
        n = h * w
        r_mean = float(np.mean(rgb[:, :, 0]))
        g_mean = float(np.mean(rgb[:, :, 1]))
        b_mean = float(np.mean(rgb[:, :, 2]))
        rg_corr = float(np.mean((rgb[:, :, 0] - r_mean) * (rgb[:, :, 1] - g_mean)))
        color_anomaly = 0.5 if abs(rg_corr) > 0.9 * 128 * 128 else 0.15

        # Scoring
        hf_score = 0.7 if hf_noise < 0.03 else (0.6 if hf_noise > 0.25 else 0.3)
        var_score = 0.65 if avg_var < 100 else (0.55 if avg_var > 5000 else 0.2)
        edge_score = 0.6 if edge_ratio > 0.7 else (0.55 if edge_ratio < 0.1 else 0.2)
        blended = hf_score * 0.3 + var_score * 0.25 + edge_score * 0.25 + color_anomaly * 0.2

        return {
            "hf_noise": round(hf_noise, 4),
            "local_variance": round(avg_var, 4),
            "edge_coherence": round(edge_ratio, 4),
            "color_anomaly": round(color_anomaly, 4),
            "heuristic_score": round(blended, 4),
        }
    except Exception as e:
        logger.error(f"Heuristic analysis failed: {e}")
        return {"heuristic_score": 0.5, "error": str(e)}


# ─────────────────────────────────────────────
# XceptionNet Inference
# ─────────────────────────────────────────────

def _run_xception(image_array: np.ndarray) -> Optional[dict]:
    """Run XceptionNet ONNX on a face image. Returns anomaly score."""
    session = _load_onnx_model("xceptionnet")
    if session is None:
        return None

    tensor = _preprocess_for_xception(image_array, target_size=(299, 299))
    if tensor is None:
        return None

    try:
        input_name = session.get_inputs()[0].name
        output = session.run(None, {input_name: tensor})[0]

        # Binary classification: [real_score, fake_score]
        if output.shape[-1] == 2:
            probs = 1.0 / (1.0 + np.exp(-output[0]))  # sigmoid
            fake_prob = float(probs[1])
            return {
                "fake_probability": round(fake_prob, 4),
                "real_probability": round(float(probs[0]), 4),
                "ml_score": round(min(1.0, fake_prob * 1.2), 4),
            }
        # Single output (logit)
        elif output.shape[-1] == 1:
            logit = float(output[0][0])
            fake_prob = 1.0 / (1.0 + np.exp(-logit))
            return {
                "fake_probability": round(fake_prob, 4),
                "ml_score": round(min(1.0, fake_prob * 1.2), 4),
            }
        # Multi-class (use max confidence as anomaly indicator)
        else:
            probs = np.exp(output[0]) / np.sum(np.exp(output[0]))
            max_prob = float(np.max(probs))
            max_idx = int(np.argmax(probs))
            anomaly = 0.6 if (max_prob > 0.92 or max_prob < 0.15) else 0.15
            return {
                "top_class": max_idx,
                "top_confidence": round(max_prob, 4),
                "ml_score": round(anomaly, 4),
            }
    except Exception as e:
        logger.error(f"XceptionNet inference failed: {e}")
        return None


# ─────────────────────────────────────────────
# Face Matching
# ─────────────────────────────────────────────

def _compute_face_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    """Compute 128-d face embedding using face_recognition library."""
    fr = _get_face_recognition()
    if fr is None:
        return None
    try:
        rgb = _load_image_as_rgb(image_bytes)
        encodings = fr.face_encodings(rgb)
        if len(encodings) == 0:
            return None
        return encodings[0]
    except Exception as e:
        logger.error(f"Face embedding failed: {e}")
        return None


def _compare_faces(embedding_a: np.ndarray, embedding_b: np.ndarray, threshold: float = 0.6) -> dict:
    """Compare two face embeddings. Returns match result."""
    distance = float(np.linalg.norm(embedding_a - embedding_b))
    similarity = max(0.0, 1.0 - distance)
    return {
        "match": distance < threshold,
        "distance": round(distance, 4),
        "similarity": round(similarity, 4),
        "threshold": threshold,
    }


# ─────────────────────────────────────────────
# Audio Analysis
# ─────────────────────────────────────────────

def _analyze_audio_deep(image_bytes: bytes = None, audio_path: str = None) -> dict:
    """Deep audio analysis with Librosa spectral features."""
    try:
        import librosa

        if audio_path:
            y, sr = librosa.load(audio_path, sr=16000)
        else:
            return {"error": "No audio source provided"}

        # Core features
        rms = float(np.mean(librosa.feature.rms(y=y)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        spectral_contrast = np.mean(librosa.feature.spectral_contrast(y=y, sr=sr))
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_means = [float(np.mean(mfccs[i])) for i in range(13)]
        mfcc_stds = [float(np.std(mfccs[i])) for i in range(13)]

        # Feature variance (low variance = synthetic)
        frame_rms = librosa.feature.rms(y=y)[0]
        rms_var = float(np.var(frame_rms))

        # Onset strength (natural speech has more variation)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onset_var = float(np.var(onset_env))

        # Tempo variation (synthetic speech is often too regular)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo_val = float(tempo) if hasattr(tempo, '__float__') else float(tempo[0]) if len(tempo) > 0 else 0

        # Scoring heuristics
        score = 0.3
        reasons = []

        # Very low energy → possible synthetic
        if rms < 0.005:
            score += 0.15
            reasons.append("very low energy")
        elif rms < 0.01:
            score += 0.08
            reasons.append("low energy")

        # Abnormal zero crossing rate
        if zcr > 0.2:
            score += 0.1
            reasons.append("high ZCR")
        elif zcr < 0.01:
            score += 0.08
            reasons.append("very low ZCR")

        # Spectral centroid out of normal speech range
        if spectral_centroid > 5000:
            score += 0.1
            reasons.append("high spectral centroid")
        elif spectral_centroid < 200:
            score += 0.08
            reasons.append("very low spectral centroid")

        # Low RMS variance → too uniform
        if rms_var < 0.0001:
            score += 0.12
            reasons.append("uniform energy (synthetic)")
        elif rms_var < 0.001:
            score += 0.05
            reasons.append("low energy variance")

        # Low onset variation → robotic
        if onset_var < 0.5:
            score += 0.1
            reasons.append("low onset variation")

        score = min(1.0, score)

        return {
            "confidence": round(score * 100, 1),
            "verdict": "LIKELY_SYNTHETIC" if score > 0.6 else ("SUSPICIOUS" if score > 0.35 else "LIKELY_NATURAL"),
            "features": {
                "rms_energy": round(rms, 6),
                "zero_crossing_rate": round(zcr, 6),
                "spectral_centroid": round(spectral_centroid, 2),
                "spectral_rolloff": round(spectral_rolloff, 2),
                "spectral_bandwidth": round(spectral_bandwidth, 2),
                "spectral_contrast": round(float(spectral_contrast), 4),
                "rms_variance": round(rms_var, 8),
                "onset_variance": round(onset_var, 6),
                "tempo": round(tempo_val, 2),
                "mfcc_means": [round(m, 4) for m in mfcc_means],
                "mfcc_stds": [round(m, 4) for m in mfcc_stds],
            },
            "reasons": reasons,
        }
    except Exception as e:
        logger.error(f"Audio analysis failed: {e}")
        return {"confidence": 0, "verdict": "ANALYSIS_FAILED", "error": str(e)}


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    models_status = {}
    for name, session in _models.items():
        try:
            models_status[name] = {
                "loaded": True,
                "inputs": [i.name for i in session.get_inputs()],
                "outputs": [o.name for o in session.get_outputs()],
            }
        except:
            models_status[name] = {"loaded": True}
    return {
        "status": "ok",
        "version": "2.0.0",
        "models": models_status,
        "mtcnn_loaded": _face_cascade is not None,
        "face_recognition_available": _get_face_recognition() is not None,
    }


@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    """Full deepfake detection pipeline: face extraction → XceptionNet → heuristic scoring."""
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 15MB)")
    if len(contents) < 100:
        raise HTTPException(400, "File too small or empty")

    # 1. Heuristic analysis (always runs, fast)
    heuristic = _heuristic_analysis(contents)

    # 2. Face extraction with MTCNN
    faces = _extract_faces_mtcnn(contents)
    face_count = len(faces)

    # 3. XceptionNet on each extracted face
    face_results = []
    ml_score_avg = None
    for i, face in enumerate(faces):
        ml_result = _run_xception(face["cropped_rgb"])
        if ml_result:
            face_results.append({
                "face_index": i,
                "bbox": face["bbox"],
                "detection_confidence": round(face["confidence"], 4),
                "landmarks": {k: [int(v[0]), int(v[1])] for k, v in face["landmarks"].items()},
                "ml": ml_result,
            })
            if ml_score_avg is None:
                ml_score_avg = ml_result["ml_score"]
            else:
                ml_score_avg = (ml_score_avg + ml_result["ml_score"]) / 2

    # 4. Combine scores
    h_score = heuristic.get("heuristic_score", 0.5)

    if ml_score_avg is not None:
        # Weighted: ML 60%, heuristic 40%
        final = ml_score_avg * 0.6 + h_score * 0.4
    elif face_count == 0:
        # No faces found — rely on heuristic only
        final = h_score * 0.8 + 0.1
    else:
        # Faces found but ML failed — heuristic only
        final = h_score * 0.7 + 0.15

    final = max(0.0, min(1.0, final))
    confidence = round(final * 100, 1)

    if final > 0.6:
        verdict = "LIKELY_SYNTHETIC"
    elif final > 0.35:
        verdict = "SUSPICIOUS"
    else:
        verdict = "LIKELY_NATURAL"

    return JSONResponse({
        "confidence": confidence,
        "verdict": verdict,
        "face_count": face_count,
        "faces": face_results,
        "heuristic": heuristic,
        "ml_avg_score": round(ml_score_avg, 4) if ml_score_avg is not None else None,
        "filename": file.filename,
    })


@app.post("/detect/audio")
async def detect_audio(file: UploadFile = File(...)):
    """Analyze audio for voice cloning indicators."""
    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 25MB)")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = _analyze_audio_deep(audio_path=tmp_path)
        result["filename"] = file.filename
        return JSONResponse(result)
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass


@app.post("/face/match")
async def face_match(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    threshold: float = Form(0.6),
):
    """Compare two face images for identity match."""
    contents_a = await file_a.read()
    contents_b = await file_b.read()

    emb_a = _compute_face_embedding(contents_a)
    emb_b = _compute_face_embedding(contents_b)

    if emb_a is None:
        raise HTTPException(400, "No face detected in first image")
    if emb_b is None:
        raise HTTPException(400, "No face detected in second image")

    result = _compare_faces(emb_a, emb_b, threshold=threshold)
    result["file_a"] = file_a.filename
    result["file_b"] = file_b.filename
    return JSONResponse(result)


@app.post("/face/embedding")
async def face_embedding(file: UploadFile = File(...)):
    """Compute face embedding for enrollment."""
    contents = await file.read()
    emb = _compute_face_embedding(contents)
    if emb is None:
        raise HTTPException(400, "No face detected in image")
    return JSONResponse({
        "embedding": emb.tolist(),
        "dimension": len(emb),
        "filename": file.filename,
    })


@app.post("/models/download")
async def download_models():
    """Download required ONNX models from HuggingFace."""
    import subprocess
    results = {}
    model_url = "https://huggingface.co/redgerd/XceptionNet-Keras/resolve/main/xceptionnet_keras.onnx"
    model_path = MODEL_DIR / "xceptionnet.onnx"

    if model_path.exists():
        results["xceptionnet"] = "already exists"
    else:
        try:
            proc = subprocess.run(
                ["curl", "-fSL", "-o", str(model_path), model_url],
                capture_output=True, text=True, timeout=300
            )
            if proc.returncode == 0:
                size_mb = model_path.stat().st_size / (1024 * 1024)
                results["xceptionnet"] = f"downloaded ({size_mb:.1f} MB)"
            else:
                results["xceptionnet"] = f"download failed: {proc.stderr[:200]}"
        except Exception as e:
            results["xceptionnet"] = f"error: {e}"

    return JSONResponse(results)
