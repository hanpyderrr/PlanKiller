# NAS 部署说明

目标服务器：

- 地址：`192.168.31.26`
- 用户：`ding`
- 系统：Ubuntu 22.04 x86_64

## 部署步骤

将项目复制到服务器后执行：

```bash
cd daily-companion
cp .env.example .env
# 编辑 .env，填写各项密钥
mkdir -p data backups
docker compose -f infra/docker-compose.yml up -d --build
```

验证服务正常：

```bash
curl http://127.0.0.1:8710/health
curl http://192.168.31.26:8710/health
```

## 环境变量（服务器 .env）

以下变量需在服务器 `.env` 中配置，不提交到 git：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `QQ_BOT_APP_ID`
- `QQ_BOT_SECRET`
- `QQ_BOT_TARGET_ID`
- `QQ_BOT_ENABLED`

## 数据备份

```bash
bash infra/backup.sh
```

SQLite 数据库文件位于 `data/daily_companion.db`，备份输出到 `backups/`。
