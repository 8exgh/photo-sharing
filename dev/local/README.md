# Local Productionization

Simulates the full production install on a fresh Ubuntu 24.04 Vagrant box: a
local Docker registry on the host, a single `curl | sudo bash` install on the
VM, and Watchtower auto-redeploying when a new image is pushed.

## Architecture

```
HOST (your machine)                          VAGRANT VM  (ovh-sim, 192.168.56.20)
+----------------------------+               +--------------------------------+
| registry:2 @ :5000         |<-- pull ------|  watchtower (polls every 30s)  |
|                            |  192.168.56.1 |  app (tik_tycholaz)            |
| build-and-push.sh          |               |  caddy (HTTP reverse proxy)    |
|   builds app/ image                        |                                |
|   pushes :latest + ts tag  |               |  /etc/docker/daemon.json:      |
|                            |               |    insecure-registries:        |
| serve-bootstrap.sh         |<-- curl ------|      ["192.168.56.1:5000"]     |
|   python http.server                       |                                |
|   serves deploy/production |               |  Access from host:             |
+----------------------------+               |    http://localhost:8090       |
                                             +--------------------------------+
```

The same `deploy/production/bootstrap.sh` is used here and on a real VPS — only
the arguments differ.

## Quick start

```bash
# 1. Start the local registry (host, leave running)
cd dev/registry && ./start-registry

# 2. Build & push the photo app image (host)
cd dev/local && bash build-and-push.sh

# 3. Bring up the Vagrant VM (this creates 192.168.56.1 on the host)
cd dev/vagrant-ovh-ubuntu-24.04 && ./vagrant-up

# 4. Serve the bootstrap script from the host (foreground, leave running)
cd dev/local && bash serve-bootstrap.sh

# 5. From inside the VM, install in one command
cd dev/vagrant-ovh-ubuntu-24.04 && ./vagrant-ssh
# inside VM:
curl -fsSL http://192.168.56.1:8000/bootstrap.sh \
  | sudo bash -s -- :80 changeme 192.168.56.1:5000/tik_tycholaz:latest 30

# 6. Verify from the host
curl -I http://localhost:8090
```

## Iterating

```bash
# Edit something visible in app/
cd dev/local && bash build-and-push.sh
# Within ~30s watchtower in the VM pulls the new :latest and restarts the app.
# Hard-refresh http://localhost:8090 to see the change.
```

## Verification checklist

1. `curl -sf http://localhost:5000/v2/` → `{}`
2. `curl -s http://localhost:5000/v2/_catalog` → contains `tik_tycholaz`
3. `vagrant status` → `running`; `ip -4 addr show | grep 192.168.56.1` → present
4. Inside VM: `curl -sI http://192.168.56.1:8000/bootstrap.sh` → `200`
5. Inside VM after install: `docker ps` → app, caddy, watchtower all `Up`
6. From host: `curl -sI http://localhost:8090` → `200`
7. Re-push image, wait ≤30s, see the change live

## Cleanup

```bash
cd dev/vagrant-ovh-ubuntu-24.04 && ./vagrant-destroy
cd dev/registry && ./stop-registry
```

## Going to production

The same `bootstrap.sh` works on a real VPS — change the args:

```bash
# On the VPS (host the script anywhere reachable, e.g. a gist or homelab.local)
curl -fsSL http://<somewhere>/bootstrap.sh \
  | sudo bash -s -- photos.example.com s3cretpass ghcr.io/8exgh/tik_tycholaz:latest
# 4th arg omitted → defaults to 300s poll, the production setting.
```
