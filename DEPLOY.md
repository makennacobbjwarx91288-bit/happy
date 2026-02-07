# 部署说明

## 当前默认：仅后端（API 服务器）

- **服务器**只跑 **Node 后端 + Nginx 反向代理**，占 80 端口，只提供 `/api` 和 `/socket.io`，**不提供前端页面**。
- **前端**放在你自己的域名（如 Cloudflare Pages、Vercel、或任意静态托管），用户通过该域名访问；前端请求会发到你配置的后端地址。

### 服务器上（XShell）

```bash
git clone git@github.com:你的用户名/仓库名.git /opt/beard-shop
cd /opt/beard-shop
bash install.sh
```

会启动两个容器：`shop-backend`（Node）、`shop-nginx`（只转发 API/Socket.io）。访问 `http://服务器IP/api/health` 可验证。

### 前端单独部署（另一域名）

1. 本地构建时指定后端地址（无协议时默认用当前站点的协议）：
   ```bash
   # 例如后端在 http://api.yourdomain.com
   VITE_API_URL=http://api.yourdomain.com npm run build
   # 或 HTTPS
   VITE_API_URL=https://api.yourdomain.com npm run build
   ```
2. 把 `dist/` 部署到任意静态托管（Cloudflare Pages、Vercel、Nginx 等），域名解析到该托管即可。
3. 后台路径在构建时通过 `ADMIN_PATH` 注入（若用 Lovable/CI 构建，在环境变量里设 `ADMIN_PATH=/你的随机路径`）。

---

## 可选：前后端同一台机（一体机）

若希望**同一台服务器**既提供前端页面又提供 API（一个 80 端口）：

```bash
cd /opt/beard-shop
# .env 里要有 ADMIN_PATH，例如 ADMIN_PATH=/manage-xxxx
docker compose -f docker-compose.full.yml up -d --build
```

此时 80 端口会同时提供 SPA 和 `/api`、`/socket.io`，无需单独部署前端。
