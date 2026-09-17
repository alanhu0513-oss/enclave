
import os
import httpx
import json
import asyncio
from pathlib import Path

# Config
ML_SERVICE_URL = "http://localhost:8001"
BENCHMARK_DIR = Path("/tmp/abench")
RESULTS_DIR = Path("/Users/hu/Documents/enclave/ml-service/benchmark/results")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

async def run_benchmark():
    async with httpx.AsyncClient(timeout=30.0) as client:
        results = {"timestamp": os.popen("date").read().strip(), "samples": []}
        
        # Audio benchmark
        for set_type in ["real", "fake"]:
            type_dir = BENCHMARK_DIR / set_type
            if not type_dir.exists(): continue
            for f in type_dir.glob("*.[wm][pa][3v]*"):
                with open(f, "rb") as audio_file:
                    resp = await client.post(f"{ML_SERVICE_URL}/detect/audio", files={"file": audio_file})
                    if resp.status_code == 200:
                        results["samples"].append({"file": f.name, "type": set_type, "result": resp.json()})
        
        # Image benchmark
        for img_path in ["/tmp/fake_0.jpg", "/tmp/real_0.jpg"]:
            if not os.path.exists(img_path): continue
            with open(img_path, "rb") as img_file:
                resp = await client.post(f"{ML_SERVICE_URL}/detect/image", files={"image": img_file})
                if resp.status_code == 200:
                    results["samples"].append({"file": img_path, "type": "image", "result": resp.json()})
        
        # Save results
        with open(RESULTS_DIR / "results.json", "w") as rf:
            json.dump(results, rf, indent=2)
            
    print("Benchmark complete. See results.json")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
