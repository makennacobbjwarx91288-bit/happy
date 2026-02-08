# 部署说明

## 一、用 Xshell 部署到服务器

### 安装流程速览（仅命令）

在 Xshell 连接服务器后，按顺序执行（克隆地址和路径按你的仓库修改）：

```bash
# 安装 Git（若未装）
sudo apt-get update && sudo apt-get install -y git

# 克隆私仓（HTTPS + Token 示例，替换 用户名、token、仓库名）
git clone https://你的用户名:你的token@github.com/你的用户名/仓库名.git /opt/beard-shop

# 进入目录并一键部署
cd /opt/beard-shop
bash install.sh

# 部署完成后查看主账号与密码
cat /opt/beard-shop/.env
```

若 `install.sh` 报错 `$'\r': command not found`，先执行：`sed -i 's/\r$//' install.sh`，再执行 `bash install.sh`。

---

### 1. 连接服务器

1. 打开 **Xshell**，新建会话：
   - 协议：**SSH**
   - 主机：填你服务器的 **IP**
   - 端口：**22**（默认）
   - 用户名：一般是 `root` 或你创建的 Linux 用户
2. 认证：选「密码」或「公钥」，填好保存，连接。

### 2. 安装 Git（若未装）

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y git
```

### 3. 克隆你的 GitHub 私仓

**方式 A：用 SSH（推荐，需先在服务器配好 SSH 公钥并加到 GitHub）**

```bash
# 把 你的用户名 和 仓库名 换成你自己的
git clone git@github.com:你的用户名/beard-brand-collective-33-main.git /opt/beard-shop
```

若提示 `Permission denied (publickey)`，说明服务器还没加 GitHub 公钥，用下面的方式 B。

**方式 B：用 HTTPS + 个人访问令牌（私仓简单做法）**

1. GitHub → Settings → Developer settings → Personal access tokens → 生成一个 token（勾选 `repo`）。
2. 在 Xshell 里执行（把 `你的用户名`、`仓库名`、`你的token` 换成真实值）：

```bash
git clone https://你的用户名:你的token@github.com/你的用户名/仓库名.git /opt/beard-shop
```

例如：`git clone https://zhangsan:ghp_xxxx@github.com/zhangsan/beard-brand-collective-33-main.git /opt/beard-shop`

### 4. 一键部署（前端 + 后端，同一台机）

```bash
cd /opt/beard-shop
bash install.sh
```

脚本会：
- 若无 Docker 则安装 Docker；
- 若没有 `.env` 则生成随机 `ADMIN_PATH`、主账号密码并写入 `.env`；
- 构建并启动 **前端 + 后端**（`docker-compose.full.yml`），占 80 端口。

### 5. 查看结果与验证

- 脚本结束会打印 **API 地址**、**管理后台地址**（`http://你的服务器IP/随机路径`），以及「主账号在 .env 里」的提示。
- **管理后台**：浏览器打开 `http://你的服务器IP/ADMIN_PATH`（如 `http://47.251.245.241/ZNjxymESpJ6BXxfujJ82`），应出现登录页。
- **商店前台**：**没有**通过 IP 的入口。只有在你把域名解析到本机、并在管理端「店铺管理」里添加该域名后，用户访问该域名才会看到商店页面。见下文「商店用域名」。
- **验证接口**：`http://你的服务器IP/api/health` 应返回 `{"status":"ok",...}`。

### 6. 获取主账号与密码

安装脚本**不会在终端里直接打印账号和密码**，是为了避免：
- 写入 Shell 历史（`~/.bash_history`），被他人或脚本读取；
- 进入 CI/运维日志，造成泄露；
- 屏幕肩窥、录屏等风险。

**在服务器上查看主账号和密码：**

```bash
cd /opt/beard-shop
cat .env
```

在输出中找到并记下：
- **INIT_ADMIN_USER**：主账号用户名  
- **INIT_ADMIN_PASS**：主账号密码  
- **ADMIN_PATH**：后台路径（如 `/ZNjxymESpJ6BXxfujJ82`），前端登录地址需要与之一致。

**首次登录后**请到后台「账号管理」中修改主账号密码。

### 7. 以后更新代码

```bash
cd /opt/beard-shop
git pull
bash update.sh
```

或手动：`docker compose -f docker-compose.full.yml up -d --build`

---

## 二、访问方式说明（一键部署后）

| 用途 | 地址 | 说明 |
|------|------|------|
| **管理后台** | `http://服务器IP/随机路径` | 如 `http://47.251.245.241/ZNjxymESpJ6BXxfujJ82`，随机路径在 `.env` 的 `ADMIN_PATH`。 |
| **商店前台** | **仅域名**（见下） | 无 IP 入口；必须在管理端添加域名后，用该域名访问才显示商店。 |
| **API** | `http://服务器IP/api/` | 前端和后台都会请求该地址。 |

### 商店用域名（唯一入口）

商店**没有**通过 IP 或未配置域名的入口；只有同时满足下面两点时，用户访问才会看到商店页面：

1. **域名解析**：在域名服务商处把商店域名（如 `shop.yourdomain.com`）**A 记录**解析到本机公网 IP。
2. **管理端添加域名**：登录管理后台 → **店铺管理** → 新建店铺或为已有店铺**添加域名**，把该域名（如 `shop.yourdomain.com`）填进去并保存。

之后用户访问 `https://shop.yourdomain.com`（或 `http://`，视你是否配置 SSL）才会打开商店。  
若需 HTTPS，在服务器前加 Nginx + Let’s Encrypt 或 CDN（如 Cloudflare）开启 SSL。

---

## 三、可选：仅后端（API）部署

若你希望**商店前端**放在别处（如 Cloudflare Pages、Vercel），只在这台服务器跑 API：

```bash
cd /opt/beard-shop
docker compose up -d --build
```

此时仅启动后端 + Nginx（`docker-compose.yml`），80 端口只提供 `/api`、`/socket.io`，访问 `http://服务器IP/` 会 404。商店和后台需在别处构建并配置 `VITE_API_URL` 指向 `http://服务器IP`（或你的 API 域名）。

---

## 四、加新店与店铺装修

### 加新店（新店铺 + 域名）

1. 登录管理后台 → 侧栏 **店铺管理**（Shop Management）。
2. 点击 **新建店铺**（New Shop）。
3. 选择 **源码/模板**（当前仅「胡须店」），填写 **店铺名称**、**主域名**（如 `shop2.example.com`），保存。
4. 在域名服务商处把该域名 **A 记录** 解析到本服务器 IP（若用 Cloudflare，建议小云朵开启）。
5. 同一店铺下可再点 **添加域名** 绑定更多域名（如子域名、备用域名），每个域名都需先做好 DNS 解析。

新店创建后，用户访问你绑定的任意域名即可看到该店铺前台。

### 装修现有店铺（改板块、换图等）

当前版本**没有**在管理后台里直接编辑店铺首页板块、图片、文案的配置页。若需改首页内容、轮播图、商品区等，需要：

- **方式 A**：改前端源码（如胡须店对应的前端组件与资源），再重新构建并部署。
- **方式 B**：后续可做「店铺配置 + 管理端可视化编辑」功能，届时可在后台直接编辑板块与素材，无需改代码。

客人下单时填写的姓名、地址、优惠券等信息**始终按用户填写原文保存**，不会随管理端界面语言（中文/英文）改变。
