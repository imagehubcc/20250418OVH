
# OVH Titan Sniper 后端

这是OVH Titan Sniper的Python后端，提供了OVH服务器监控和抢购的功能。

## 功能特点

- 服务器列表获取和管理
- 服务器可用性检查
- 抢购队列管理
- 订单历史记录
- 实时日志和WebSocket通信
- Telegram通知集成

## 开发环境配置

1. 安装依赖项：

```bash
pip install -r requirements.txt
```

2. 运行开发服务器：

```bash
uvicorn main:app --reload
```

服务器将在 http://localhost:8000 上运行，API文档可在 http://localhost:8000/docs 访问。

## API端点

- `GET /api/servers` - 获取服务器列表
- `GET /api/servers/{plan_code}/availability` - 检查特定服务器的可用性
- `GET/POST /api/config` - 获取/设置API配置
- `GET/POST /api/tasks` - 获取/创建抢购任务
- `DELETE /api/tasks/{task_id}` - 删除抢购任务
- `GET /api/orders` - 获取订单历史
- `GET /api/logs` - 获取系统日志
- `WebSocket /ws` - 实时数据和日志更新

## 使用Docker部署

构建Docker镜像：

```bash
docker build -t ovh-titan-sniper-backend .
```

运行容器：

```bash
docker run -p 8000:8000 ovh-titan-sniper-backend
```

## 注意事项

- 使用前必须通过API配置端点设置OVH API凭据。
- 为避免API限流，系统会自动管理抢购队列的执行频率。
