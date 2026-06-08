import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 5174);
const ROOT = process.cwd();
const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
const LOCAL_ASR_ENGINE = process.env.LOCAL_ASR_ENGINE || "sensevoice";
const LOCAL_ASR_BIN = process.env.LOCAL_ASR_BIN || process.env.WHISPER_CPP_BIN || join(ROOT, ".venv-asr/bin/whisper-cpp");
const LOCAL_ASR_MODEL =
  process.env.LOCAL_ASR_MODEL || process.env.WHISPER_CPP_MODEL || chooseLocalAsrModel();
const LOCAL_ASR_LANGUAGE = process.env.LOCAL_ASR_LANGUAGE || "zh";
const SENSEVOICE_PYTHON = process.env.SENSEVOICE_PYTHON || join(ROOT, ".venv-asr/bin/python");
const SENSEVOICE_WORKER = process.env.SENSEVOICE_WORKER || join(ROOT, "sensevoice_worker.py");
const SENSEVOICE_MODEL = process.env.SENSEVOICE_MODEL || "iic/SenseVoiceSmall";
const SENSEVOICE_BACKEND = process.env.SENSEVOICE_BACKEND || "onnx";
const SENSEVOICE_LANGUAGE = process.env.SENSEVOICE_LANGUAGE || "zh";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_LOCAL_PROMPT_CHARS = 600;
const LOCAL_ASR_TIMEOUT_MS = Number(process.env.LOCAL_ASR_TIMEOUT_MS || 45000);

let senseVoiceWorker = null;
let senseVoiceBuffer = "";
let senseVoiceRequestId = 0;
let senseVoiceReady = false;
const senseVoicePending = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJSON(res, {
        ok: true,
        localAsrEngine: LOCAL_ASR_ENGINE,
        senseVoiceConfigured: isSenseVoiceReady(),
        senseVoiceReady,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/asr/status") {
      const localReady = await isLocalAsrReady();
      sendJSON(res, {
        configured: Boolean(process.env.OPENAI_API_KEY),
        model: MODEL,
        local: {
          bin: LOCAL_ASR_BIN,
          configured: localReady || isSenseVoiceReady(),
          engine: LOCAL_ASR_ENGINE,
          fallback: "whisper.cpp",
          language: LOCAL_ASR_LANGUAGE,
          model: LOCAL_ASR_MODEL || null,
          senseVoice: {
            configured: isSenseVoiceReady(),
            ready: senseVoiceReady,
            backend: SENSEVOICE_BACKEND,
            language: SENSEVOICE_LANGUAGE,
            model: SENSEVOICE_MODEL,
          },
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/local-transcribe") {
      await handleLocalTranscription(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      await handleTranscription(req, res, url);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    await serveStatic(url.pathname, res, req.method === "HEAD");
  } catch (error) {
    sendText(res, 500, error?.message || "Internal server error");
  }
});

function chooseLocalAsrModel() {
  const candidates = [
    join(ROOT, "vendor/whisper.cpp/models/ggml-small.bin"),
    join(ROOT, "vendor/whisper.cpp/models/ggml-base.bin"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) || candidates[1];
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lingua Cue running at http://0.0.0.0:${PORT}`);
  console.log(`ASR model: ${MODEL}`);
  console.log(process.env.OPENAI_API_KEY ? "OpenAI ASR: configured" : "OpenAI ASR: missing OPENAI_API_KEY");
  console.log(`Local ASR engine: ${LOCAL_ASR_ENGINE}`);
  console.log(isSenseVoiceReady() ? `SenseVoice model: ${SENSEVOICE_MODEL}` : "SenseVoice: unavailable");
  console.log(LOCAL_ASR_MODEL ? `Local ASR model: ${LOCAL_ASR_MODEL}` : "Local ASR: missing LOCAL_ASR_MODEL");

  if (LOCAL_ASR_ENGINE === "sensevoice" && isSenseVoiceReady() && process.env.SENSEVOICE_PRELOAD !== "0") {
    setTimeout(() => {
      try {
        ensureSenseVoiceWorker();
      } catch (error) {
        console.error(`SenseVoice preload failed: ${error?.message || error}`);
      }
    }, 0);
  }
});

async function handleLocalTranscription(req, res, url) {
  if (!isSenseVoiceReady() && !(await isLocalAsrReady())) {
    sendText(
      res,
      500,
      "Local ASR is not configured. Install SenseVoiceSmall dependencies or configure whisper.cpp fallback."
    );
    return;
  }

  const audio = await readRequestBody(req, MAX_AUDIO_BYTES);
  if (audio.length < 1200) {
    sendJSON(res, { text: "" });
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), "lingua-cue-asr-"));
  const audioPath = join(dir, "chunk.wav");
  const outputBase = join(dir, "transcript");
  const prompt = (url.searchParams.get("prompt") || "").slice(0, MAX_LOCAL_PROMPT_CHARS);

  try {
    await writeFile(audioPath, audio);
    const result = await runLocalTranscription(audioPath, outputBase, prompt);
    sendJSON(res, {
      text: cleanTranscript(result),
      model: LOCAL_ASR_ENGINE === "sensevoice" ? "sensevoice-small" : "local-whisper",
    });
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

async function handleTranscription(req, res, url) {
  if (!process.env.OPENAI_API_KEY) {
    sendText(res, 500, "OPENAI_API_KEY is not set. Start with: OPENAI_API_KEY=... npm run dev");
    return;
  }

  const audio = await readRequestBody(req, MAX_AUDIO_BYTES);
  if (audio.length < 1200) {
    sendJSON(res, { text: "" });
    return;
  }

  const contentType = req.headers["content-type"] || "audio/webm";
  const extension = contentType.includes("mp4") ? "mp4" : contentType.includes("ogg") ? "ogg" : "webm";
  const prompt = url.searchParams.get("prompt") || "";

  const form = new FormData();
  form.set("file", new Blob([audio], { type: contentType }), `chunk.${extension}`);
  form.set("model", MODEL);
  form.set("response_format", "json");
  if (prompt) form.set("prompt", prompt);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  const text = await response.text();
  if (!response.ok) {
    sendText(res, response.status, text);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    payload = { text };
  }

  sendJSON(res, {
    text: payload.text || "",
    model: MODEL,
  });
}

async function isLocalAsrReady() {
  if (!LOCAL_ASR_MODEL) return false;

  try {
    await access(LOCAL_ASR_MODEL);
    return true;
  } catch (error) {
    return false;
  }
}

function isSenseVoiceReady() {
  return existsSync(SENSEVOICE_PYTHON) && existsSync(SENSEVOICE_WORKER);
}

async function runLocalTranscription(audioPath, outputBase, prompt = "") {
  if (LOCAL_ASR_ENGINE === "sensevoice" && isSenseVoiceReady()) {
    try {
      return await runSenseVoice(audioPath);
    } catch (error) {
      console.error(`SenseVoice failed, falling back to whisper.cpp: ${error?.message || error}`);
    }
  }

  return runLocalWhisper(audioPath, outputBase, prompt);
}

function ensureSenseVoiceWorker() {
  if (senseVoiceWorker && !senseVoiceWorker.killed) return senseVoiceWorker;

  senseVoiceWorker = spawn(SENSEVOICE_PYTHON, [SENSEVOICE_WORKER], {
    cwd: ROOT,
    env: {
      ...process.env,
      SENSEVOICE_LANGUAGE,
      SENSEVOICE_MODEL,
      SENSEVOICE_BACKEND,
      PYTHONUNBUFFERED: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  senseVoiceBuffer = "";

  senseVoiceWorker.stdout.on("data", (chunk) => {
    senseVoiceBuffer += chunk.toString("utf8");
    let lineEnd;
    while ((lineEnd = senseVoiceBuffer.indexOf("\n")) >= 0) {
      const line = senseVoiceBuffer.slice(0, lineEnd).trim();
      senseVoiceBuffer = senseVoiceBuffer.slice(lineEnd + 1);
      if (line) handleSenseVoiceLine(line);
    }
  });

  senseVoiceWorker.stderr.on("data", (chunk) => {
    const message = chunk.toString("utf8").trim();
    if (message) console.error(`[sensevoice] ${message}`);
  });

  senseVoiceWorker.on("close", (code) => {
    const error = new Error(`SenseVoice worker exited with code ${code}`);
    for (const pending of senseVoicePending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    senseVoicePending.clear();
    senseVoiceWorker = null;
  });

  senseVoiceWorker.on("error", (error) => {
    for (const pending of senseVoicePending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    senseVoicePending.clear();
    senseVoiceWorker = null;
  });

  return senseVoiceWorker;
}

function handleSenseVoiceLine(line) {
  let payload;
  try {
    payload = JSON.parse(line);
  } catch (error) {
    console.error(`[sensevoice] ${line}`);
    return;
  }

  if (payload.type === "ready") {
    senseVoiceReady = true;
    console.log(`SenseVoice worker ready: ${payload.model} (${payload.backend || SENSEVOICE_BACKEND})`);
    return;
  }

  const pending = senseVoicePending.get(payload.id);
  if (!pending) return;
  clearTimeout(pending.timer);
  senseVoicePending.delete(payload.id);

  if (payload.error) {
    pending.reject(new Error(payload.error));
  } else {
    pending.resolve(payload.text || "");
  }
}

function runSenseVoice(audioPath) {
  const worker = ensureSenseVoiceWorker();
  const id = ++senseVoiceRequestId;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      senseVoicePending.delete(id);
      reject(new Error("SenseVoice request timed out"));
    }, LOCAL_ASR_TIMEOUT_MS);

    senseVoicePending.set(id, { reject, resolve, timer });
    worker.stdin.write(
      JSON.stringify({
        id,
        audioPath,
        language: SENSEVOICE_LANGUAGE,
        useItN: true,
      }) + "\n"
    );
  });
}

function runLocalWhisper(audioPath, outputBase, prompt = "") {
  const args = [
    "-m",
    LOCAL_ASR_MODEL,
    "-f",
    audioPath,
    "-l",
    LOCAL_ASR_LANGUAGE,
    "-otxt",
    "-of",
    outputBase,
    "-nt",
  ];

  if (prompt) {
    args.push("--prompt", prompt);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(LOCAL_ASR_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Local ASR exited with code ${code}`));
        return;
      }

      try {
        const fileText = await readFile(`${outputBase}.txt`, "utf8");
        resolve(fileText || stdout);
      } catch (error) {
        resolve(stdout);
      }
    });
  });
}

function cleanTranscript(text) {
  return text
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function serveStatic(pathname, res, headOnly) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (!headOnly) res.end(data);
    else res.end();
  } catch (error) {
    sendText(res, 404, "Not found");
  }
}

function readRequestBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Audio chunk too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJSON(res, payload) {
  setCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  setCorsHeaders(res);
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Chunk-Id");
}
