import json
import os
import sys
import time
import traceback
from contextlib import redirect_stdout


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def load_model():
    backend = os.environ.get("SENSEVOICE_BACKEND", "onnx").strip().lower()
    model_dir = os.environ.get("SENSEVOICE_MODEL", "iic/SenseVoiceSmall")
    batch_size = int(os.environ.get("SENSEVOICE_BATCH_SIZE", "1"))

    with redirect_stdout(sys.stderr):
        if backend == "funasr":
            from funasr import AutoModel
            from funasr.utils.postprocess_utils import rich_transcription_postprocess

            device = os.environ.get("SENSEVOICE_DEVICE", "cpu")
            model = AutoModel(model=model_dir, trust_remote_code=True, device=device)
            return backend, model, rich_transcription_postprocess

        from funasr_onnx import SenseVoiceSmall
        from funasr_onnx.utils.postprocess_utils import rich_transcription_postprocess

        quantize = os.environ.get("SENSEVOICE_QUANTIZE", "1") != "0"
        model = SenseVoiceSmall(model_dir, batch_size=batch_size, quantize=quantize)
        return "onnx", model, rich_transcription_postprocess


def main():
    backend, model, postprocess = load_model()
    emit(
        {
            "type": "ready",
            "backend": backend,
            "model": os.environ.get("SENSEVOICE_MODEL", "iic/SenseVoiceSmall"),
        }
    )

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        started = time.perf_counter()
        request = {}
        try:
            request = json.loads(line)
            audio_path = request["audioPath"]
            language = request.get("language") or os.environ.get("SENSEVOICE_LANGUAGE", "zh")
            use_itn = bool(request.get("useItN", True))

            if backend == "funasr":
                with redirect_stdout(sys.stderr):
                    result = model.generate(
                        input=audio_path,
                        cache={},
                        language=language,
                        use_itn=use_itn,
                        batch_size_s=int(os.environ.get("SENSEVOICE_BATCH_SIZE_S", "60")),
                        merge_vad=False,
                    )
                first = result[0] if result else {}
                raw_text = first.get("text", "") if isinstance(first, dict) else str(first)
            else:
                with redirect_stdout(sys.stderr):
                    result = model([audio_path], language=language, use_itn=use_itn)
                raw_text = result[0] if result else ""

            text = postprocess(raw_text)
            emit(
                {
                    "id": request.get("id"),
                    "backend": backend,
                    "model": "SenseVoiceSmall",
                    "latencyMs": round((time.perf_counter() - started) * 1000),
                    "text": text.strip(),
                }
            )
        except Exception as error:
            emit(
                {
                    "id": request.get("id"),
                    "error": str(error),
                    "trace": traceback.format_exc(limit=2),
                }
            )


if __name__ == "__main__":
    main()
