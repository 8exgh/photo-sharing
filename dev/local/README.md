# Local Productionization

Simulates the full production pipeline locally: build, push to a local Docker registry, and auto-deploy via Watchtower in a Vagrant VM.

## Architecture

```
HOST (your machine)                      VAGRANT VM (client production sim)
+---------------------+                  +------------------------------+
| local registry:2    |<-- pull ---------|  watchtower (polls every 30s)|
| localhost:5000      |   192.168.56.1   |                              |
|                     |                  |  app (tik_tycholaz)          |
| build-and-push.sh   |                  |  caddy (reverse proxy, HTTP) |
| builds app/ image   |                  |                              |
| pushes to registry  |                  |  Docker daemon configured    |
+---------------------+                  |  with insecure-registries    |
                                         |  for 192.168.56.1:5000       |
                                         +------------------------------+
                                         IP: 192.168.56.10
                                         Access: http://localhost:8080
                                                 http://192.168.56.10
```

## Quick Start

```bash
# 1. Start local registry (once, leave running)
cd dev/registry && ./start-registry

# 2. Build and push the app image (must run before first vagrant up)
cd dev/local && bash build-and-push.sh

# 3. Start the Vagrant VM
cd dev/vagrant/harness-vm && ./vagrant-up

# 4. Access the app
curl http://localhost:8080   # or http://192.168.56.10
```

## Iterating

After making code changes:

```bash
cd dev/local && bash build-and-push.sh
# Watchtower picks up the new image within ~30 seconds
```

## Verification

1. Registry running: `curl http://localhost:5000/v2/` returns `{}`
2. Image pushed: `curl http://localhost:5000/v2/_catalog` shows `tik_tycholaz`
3. App accessible: `curl http://localhost:8080` returns HTML
4. Auto-update: push a new image, wait 30s, verify the change is live

## Cleanup

```bash
cd dev/vagrant/harness-vm && ./vagrant-destroy
cd dev/registry && ./stop-registry
```
