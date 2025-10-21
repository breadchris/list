# Stage 1: Build Go binary
FROM golang:1.23-alpine AS go-builder

WORKDIR /go-build

# Copy Go source files
COPY go/ ./

# Tidy and download Go dependencies
RUN go mod tidy && go mod download

# Build Go binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o youtube-handler .

# Stage 2: Build TypeScript with esbuild
FROM node:20-alpine AS ts-builder

WORKDIR /build

# Copy package files and install all dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY src/ ./src/

# Bundle with esbuild (no tree-shaking to preserve handler)
RUN npm run build

# Stage 3: Lambda runtime
FROM public.ecr.aws/lambda/nodejs:20

# Set IS_SANDBOX to enable bypassPermissions mode
ENV IS_SANDBOX=1

# Copy Go binary from builder stage
COPY --from=go-builder /go-build/youtube-handler /usr/local/bin/youtube-handler
RUN chmod +x /usr/local/bin/youtube-handler

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled TypeScript from builder stage
COPY --from=ts-builder /build/dist ./dist

# Set the CMD to your handler
# Lambda will use package.json "main" field to resolve to index.cjs
CMD [ "dist/index.handler" ]
