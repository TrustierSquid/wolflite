# Deployment (GitHub Actions + Tailscale)

Pushing to `main` deploys Wolflite to your server automatically:

```
push to main
  │
  ├─ frontend: lint, Jest, type check (report only), build     ─┐
  ├─ backend: pytest                                             ├─ all must pass
  │                                                             ─┘
  ├─ image: build the Docker image (frontend + backend), push to ghcr.io/trustiersquid/wolflite
  │
  └─ deploy: join your tailnet (temporary device, tag:ci)
             → copy compose.yml to the server
             → docker compose pull wolflite && docker compose up -d
             → health check (fails the run, with logs, if Wolflite doesn't come up)
```

Pull requests run the checks only. The workflow is `.github/workflows/ci-cd.yml`.

**Nothing is opened to the internet.** GitHub's runner reaches the server through Tailscale
and logs in with Tailscale SSH, so there are no ports to forward and no SSH keys to store.
Your database (`data/`) and uploads (`uploads/`) stay on the server and survive every deploy.

---

## One-time setup

### 1. Tailscale access rules

In the [Tailscale admin console](https://login.tailscale.com/admin/acls) → **Access controls**, add
two tags and let `tag:ci` (GitHub) SSH into `tag:wolflite-server` (your server) as your deploy user.
Replace `samuel` with the Linux user that runs Docker on the server.

```jsonc
{
  "tagOwners": {
    "tag:ci":               ["autogroup:admin"],
    "tag:wolflite-server":  ["autogroup:admin"]
  },

  // If your policy still has the default "allow everything" rule you can skip this;
  // otherwise GitHub needs to reach the server's SSH port.
  "grants": [
    { "src": ["tag:ci"], "dst": ["tag:wolflite-server"], "ip": ["tcp:22"] }
  ],

  "ssh": [
    {
      "action": "accept",
      "src":    ["tag:ci"],
      "dst":    ["tag:wolflite-server"],
      "users":  ["samuel"]
    }
  ]
}
```
Merge these into your existing policy (keep your current rules).

### 2. Tailscale on the server

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --advertise-tags=tag:wolflite-server
```
`--ssh` turns on Tailscale SSH. Note the machine's name (`tailscale status`), e.g. `homeserver`.

Make sure the deploy user can run Docker without sudo:
```bash
sudo usermod -aG docker samuel   # then log out and back in
```

### 3. Tailscale OAuth client (lets GitHub join the tailnet)

Admin console → **Settings → OAuth clients → Generate OAuth client**:
- Scope: **Auth Keys → Write**
- Tag: **tag:ci**

Copy the client ID and secret (the secret is shown once).

### 4. The folder on the server

Use the folder you deploy from today (the one with `data/`, `uploads/` and `.env`), so
the existing database and uploads are picked up as-is. It needs:

```
/home/samuel/wolflite/
  .env          DB_KEY, TUNNEL_TOKEN, MAX_UPLOAD_MB (see .env.example)
  data/         the SQLite database (created on first start if missing)
  uploads/      uploaded files
  compose.yml   copied here by every deploy
```
The server no longer needs the source code, Node or a build: it only pulls the image.

### 5. GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Example |
| --- | --- |
| `TS_OAUTH_CLIENT_ID` | from step 3 |
| `TS_OAUTH_SECRET` | from step 3 |
| `DEPLOY_HOST` | `homeserver` (Tailscale machine name) or its `100.x.y.z` address |
| `DEPLOY_USER` | `samuel` |
| `DEPLOY_PATH` | `/home/samuel/wolflite` |

### 6. First deploy

Merge into `main` (or **Actions → CI / CD → Run workflow**). The first image build takes a few
minutes; later ones are cached.

If the deploy step can't pull the image (`denied`), open the package
(github.com/TrustierSquid?tab=packages → **wolflite** → **Package settings**) and under
**Manage Actions access** add the `wolflite` repository with **Read** access.

---

## Everyday use

- **Deploy:** merge / push to `main`. Watch it under the repo's **Actions** tab; deploys are
  also listed under **Environments → production**.
- **Something broke:** the run turns red at the failing step. A failed health check prints the
  container's last log lines.
- **Roll back:** open an earlier successful run → **Re-run jobs**. Every image is also tagged
  with its commit, so on the server you can run
  `WOLFLITE_TAG=<commit sha> docker compose up -d`.
- **Redeploy without changes:** Actions → CI / CD → **Run workflow**.
- **Logs on the server:** `docker compose logs -f wolflite`
