
# 使用官方 Node 镜像作为基础镜像
FROM node:20-alpine AS build

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 构建应用
RUN npm run build

# 使用 Nginx 作为生产服务器
FROM nginx:alpine

# 复制构建产物到 Nginx 的默认静态文件目录
COPY --from=build /app/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置（如果需要）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
