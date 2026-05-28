# VINS UI

VINS UI 是一个基于 Next.js 的前端项目，用于 VINS Agent 图片编辑、Cosplay 生成和风格迁移相关交互。

## 技术栈

- Next.js 15
- React 19
- TypeScript

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

## 环境变量

项目通过 `NEXT_PUBLIC_GATEWAY_BASE_URL` 配置后端网关地址：

```bash
NEXT_PUBLIC_GATEWAY_BASE_URL=https://bluepixel.vivo.com.cn
```

如果未配置该变量，项目会默认使用 `https://bluepixel.vivo.com.cn`。

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## 目录说明

- `app/`：Next.js App Router 页面和全局样式
- `public/style-transfer/`：风格迁移相关静态图片资源
- `docs/`：接口和功能文档
- `next.config.ts`：Next.js 配置，包含后端接口 rewrite 规则
