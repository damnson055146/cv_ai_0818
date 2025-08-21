# 使用官方 Node.js 20 Alpine 镜像作为基础镜像
FROM node:20-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@8.15.6

# 复制包管理文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY site/package.json site/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder

# 复制所有源代码
COPY . .

# 构建包和应用
RUN pnpm build:pkg && pnpm build

# 生产阶段
FROM node:20-alpine AS runner

# 设置工作目录
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# 复制构建后的应用
COPY --from=builder --chown=nuxtjs:nodejs /app/site/.output ./

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# 暴露端口
EXPOSE 3000

# 切换到非 root 用户
USER nuxtjs

# 启动应用
CMD ["node", "server/index.mjs"]
