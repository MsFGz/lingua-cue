# Hugging Face Spaces Docker 部署配置 - Lingua Cue
# 支持 Node.js + Python + SenseVoiceSmall

FROM node:20-slim

ENV PORT=7860 \
    LOCAL_ASR_ENGINE=sensevoice \
    LOCAL_ASR_TIMEOUT_MS=240000 \
    SENSEVOICE_BACKEND=funasr \
    SENSEVOICE_MODEL=/app/models/SenseVoiceSmall \
    SENSEVOICE_PRELOAD=1 \
    SENSEVOICE_LANGUAGE=zh \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1

# 安装 Python 和系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    ca-certificates \
    ffmpeg \
    git \
    git-lfs \
    libgomp1 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package.json 并安装 Node.js 依赖
COPY package.json ./
RUN npm install --production

# 创建 Python 虚拟环境并安装依赖
RUN python3 -m venv /app/.venv-asr
COPY requirements.txt ./
RUN /app/.venv-asr/bin/pip install --no-cache-dir -r requirements.txt

# Hugging Face 免费 CPU 上运行时下载模型容易导致首次请求超时。
# 在构建阶段从 Hugging Face Hub 预下载模型，运行时直接使用镜像内文件。
RUN mkdir -p /app/models \
    && /app/.venv-asr/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('FunAudioLLM/SenseVoiceSmall', local_dir='/app/models/SenseVoiceSmall', allow_patterns=['*.pt','*.yaml','*.json','*.model','*.mvn','*.py'])"

# 复制项目文件
COPY . .

# Hugging Face Docker Spaces 默认通过 README 的 app_port 暴露 7860
EXPOSE 7860

# 启动命令
CMD ["node", "server.mjs"]
