FROM node:22-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Create non-root user gsd (uid/gid 1000)
RUN groupadd -g 1000 gsd && useradd -u 1000 -g gsd -m -s /bin/bash gsd

# Install Claude Code CLI globally (as root so it's available on PATH)
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || true

# Make Bun available to gsd user as well
RUN cp -r /root/.bun /home/gsd/.bun && chown -R gsd:gsd /home/gsd/.bun
ENV PATH="/home/gsd/.bun/bin:/root/.bun/bin:$PATH"

WORKDIR /workspace
RUN chown gsd:gsd /workspace

USER gsd
