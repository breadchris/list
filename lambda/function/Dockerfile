# Use AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Force rebuild with timestamp
LABEL build_timestamp="2025-10-07T02:59:00Z"

# Install Claude Code CLI globally as root
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Install build dependencies and compile TypeScript
RUN npm install typescript @types/node @types/aws-lambda && \
    npx tsc && \
    npm uninstall typescript @types/node @types/aws-lambda

# Set the CMD to your handler
CMD [ "dist/index.handler" ]
