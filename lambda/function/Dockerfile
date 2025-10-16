# Build Go binary
FROM golang:1.23-alpine AS go-builder

WORKDIR /go-build

# Copy Go source files
COPY go/ ./

# Tidy and download Go dependencies
RUN go mod tidy && go mod download

# Build Go binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o youtube-handler .

# Use AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Force rebuild with timestamp
LABEL build_timestamp="2025-10-16T00:00:00Z"

# Set IS_SANDBOX to enable bypassPermissions mode
ENV IS_SANDBOX=1

# Copy Go binary from builder stage
COPY --from=go-builder /go-build/youtube-handler /usr/local/bin/youtube-handler
RUN chmod +x /usr/local/bin/youtube-handler

# Install Claude Code CLI globally as root
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy pre-built bundled Lambda function
COPY dist/index.bundled.js ./dist/index.js

# Set the CMD to your handler
CMD [ "dist/index.handler" ]
