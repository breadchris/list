# OpenClaw Setup Guide

Complete guide to deploying OpenClaw on an EC2 spot instance with Tailscale VPN access, S3 data persistence, and Claude Code as the LLM backend.

## Prerequisites

- AWS account with EC2, S3, IAM permissions
- [Pulumi](https://www.pulumi.com/) installed (`npm install -g pulumi`)
- [Tailscale](https://tailscale.com/) account with a tailnet
- Claude Pro/Max subscription (for Claude Code OAuth)
- Slack workspace (optional, for Slack channel integration)

## Architecture

```
Slack / Control UI
       |
   Tailscale VPN
       |
EC2 Spot Instance (t3.small, Ubuntu 24.04)
  ├── openclaw-gateway (port 18789, bound to tailnet)
  ├── claude CLI (LLM backend via Claude Code OAuth)
  ├── S3 sync cron (every 5 min → s3://justshare-openclaw-data/)
  └── spot interruption handler (syncs on 2-min warning)
```

## Infrastructure (Pulumi)

All infrastructure is defined in `lambda/index.ts` (lines 773-1052). Resources created:

| Resource | Type | Details |
|----------|------|---------|
| `openclaw-ssh-key` | TLS Private Key | ED25519 SSH key for instance access |
| `openclaw-keypair` | EC2 Key Pair | SSH key registered with AWS |
| `openclaw-gateway-token` | TLS Private Key | SHA256 hash used as gateway auth token |
| `openclaw-data` | S3 Bucket | `justshare-openclaw-data` - persists config across spot interruptions |
| `openclaw-sg` | Security Group | Ingress: TCP 22 (SSH fallback). All access via Tailscale |
| `openclaw-instance-role` | IAM Role | EC2 assume role for S3 access |
| `openclaw-s3-policy` | IAM Role Policy | ListBucket, GetObject, PutObject, DeleteObject on the S3 bucket |
| `openclaw-instance-profile` | IAM Instance Profile | Attaches role to EC2 instance |
| `openclaw-spot` | EC2 Spot Instance | t3.small, 30GB gp3, persistent spot, us-east-1a |

### Pulumi Config Values Required

```bash
cd lambda

# Required for OpenClaw
pulumi config set --secret tailscale_auth_key "tskey-auth-..."
pulumi config set tailnet_dns_name "your-tailnet.ts.net"

# Required for onboarding (used in cloud-init but can be replaced post-setup)
pulumi config set --secret anthropic_api_key "sk-ant-..."
```

### Deploy

```bash
cd lambda
export PULUMI_CONFIG_PASSPHRASE=""  # for local dev
pulumi up
```

After `pulumi up`, if `desiredCount` was 0 or the spot request needs activation:
```bash
aws ec2 describe-spot-instance-requests --filters "Name=tag:Name,Values=OpenClaw" --query 'SpotInstanceRequests[0].InstanceId' --output text
```

## Cloud-Init (What Runs on First Boot)

The user-data script (`lambda/index.ts` lines 865-990) does the following in order:

1. **System updates + Docker** - `apt-get update && upgrade`, install Docker via `get.docker.com`
2. **2GB swap** - Required for t3.small (2GB RAM)
3. **AWS CLI v2** - Installed from zip (not apt, which doesn't exist on Ubuntu 24.04)
4. **Tailscale** - Installed and authenticated with `--ssh` for Tailscale SSH
5. **Node.js 22** - Via NVM for the `ubuntu` user
6. **OpenClaw** - `npm install -g openclaw@latest`
7. **S3 restore** - Syncs existing config from S3 if available
8. **OpenClaw onboard** - Non-interactive setup with gateway on port 18789
9. **S3 sync cron** - Every 5 minutes, syncs `~/.openclaw/` to S3 (excluding logs)
10. **Spot interruption handler** - Systemd service that monitors metadata endpoint and syncs on 2-min warning

### Known Issues with Cloud-Init

- **AWS CLI**: Ubuntu 24.04 removed the `awscli` apt package. Must use the official v2 zip installer.
- **Shebang corruption**: SSH shell escaping can turn `#!/bin/bash` into `#\!/bin/bash`. If the spot handler fails with exit 203/EXEC, fix with: `sudo sed -i '1s|.*|#!/bin/bash|' /usr/local/bin/openclaw-spot-handler.sh`

## Post-Deploy Manual Steps

### 1. Verify Tailscale Connectivity

```bash
tailscale status  # should show the instance
ssh ubuntu@<tailscale-ip>
```

### 2. Install Claude Code

```bash
ssh ubuntu@<tailscale-ip>
curl -fsSL https://claude.ai/install.sh | bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 3. Authenticate Claude Code (OAuth)

This must be done interactively:
```bash
ssh ubuntu@<tailscale-ip>
export PATH="$HOME/.local/bin:$PATH"
claude
# Follow the browser OAuth flow
```

### 4. Configure OpenClaw to Use Claude Code

Edit `~/.openclaw/openclaw.json` on the instance:

```json5
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "claude-cli/opus-4.6"
      },
      "cliBackends": {
        "claude-cli": {
          "command": "/home/ubuntu/.local/bin/claude"
        }
      }
    }
  }
}
```

Then restart the gateway:
```bash
kill $(pgrep -f openclaw-gateway)
# It will auto-restart if running as a daemon, or:
nohup openclaw gateway start > /dev/null 2>&1 &
```

### 5. Configure Slack Channel (Optional)

Add to `~/.openclaw/openclaw.json` under `channels.slack`:

```json5
{
  "channels": {
    "slack": {
      "mode": "socket",
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "groupPolicy": "open",
      "dm": {
        "policy": "open",
        "allowFrom": ["*"]
      }
    }
  }
}
```

Requires a Slack app with:
- Socket Mode enabled
- Bot token scopes: `chat:write`, `app_mentions:read`, `im:history`, `im:read`, `im:write`
- App-level token with `connections:write` scope
- Event subscriptions: `message.im`, `app_mention`

### 6. Verify Everything

```bash
# Check gateway is running
ps aux | grep openclaw-gateway

# Check spot handler
sudo systemctl status openclaw-spot-handler

# Check S3 sync
cat /usr/local/bin/openclaw-s3-sync.sh
sudo cat /etc/cron.d/openclaw-s3-sync

# Check Claude Code auth
export PATH="$HOME/.local/bin:$PATH"
claude --version

# Test a message
curl -H "Authorization: Bearer <gateway-token>" http://localhost:18789/api/v1/health
```

## Data Persistence

- **S3 bucket**: `justshare-openclaw-data` stores `~/.openclaw/` contents
- **Sync frequency**: Every 5 minutes via cron
- **Spot interruption**: Handler detects 2-minute warning and syncs immediately
- **On boot**: Cloud-init restores from S3 before starting OpenClaw
- **Excluded**: `logs/*` directory is not synced to save space

## Accessing the Instance

- **Primary**: `ssh ubuntu@<tailscale-ip>` (Tailscale SSH, requires approval on first connect)
- **Fallback**: `ssh -i <private-key> ubuntu@<public-ip>` (EC2 key pair, port 22)
- **Control UI**: `http://<tailscale-ip>:18789/` (token auth)
- **Gateway API**: `http://<tailscale-ip>:18789/api/...` (Bearer token auth)

## Decommissioning

To tear down all OpenClaw resources:

### 1. Sync final state to S3 (if you want to preserve data)
```bash
ssh ubuntu@<tailscale-ip> "sudo /usr/local/bin/openclaw-s3-sync.sh"
```

### 2. Remove from Tailscale
```bash
ssh ubuntu@<tailscale-ip> "sudo tailscale logout"
# Or remove from Tailscale admin console
```

### 3. Remove Pulumi resources
Remove the OpenClaw section (lines 773-1052) from `lambda/index.ts`, along with the exports. Then:
```bash
cd lambda
export PULUMI_CONFIG_PASSPHRASE=""
pulumi up  # will show resources to be deleted, confirm
```

### 4. Clean up Pulumi config
```bash
pulumi config rm tailscale_auth_key
pulumi config rm tailnet_dns_name
```

### 5. Delete S3 data (if no longer needed)
```bash
aws s3 rm s3://justshare-openclaw-data/ --recursive
```
Note: Pulumi will delete the bucket, but only if it's empty. Empty it first or add `forceDestroy: true` to the bucket resource before running `pulumi up`.

### 6. Revoke Slack app tokens (if applicable)
Revoke bot and app tokens from the Slack app management page.

### 7. Revoke Claude Code OAuth
Go to claude.ai account settings and revoke the OAuth session for the instance.
