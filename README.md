# SaiAdmin AI Prototype Base

基于 SaiAdmin Vue 5.x 的后台前端原型项目。页面始终通过 `src/api` 发起真实 HTTP 请求；开发环境由独立的 `mock-api` 提供数据，不包含数据库和生产后端逻辑。

## 架构

```text
Vue 页面 → src/api → Axios → Vite /dev 代理 → Mock API
                                               ↓ 后续替换
                                            真实后端
```

```text
src/views/product/    产品业务页面
src/api/product/      产品 API 模块
mock-api/src/         Mock HTTP 服务
mock-api/data/        JSON 示例数据
```

## 环境要求

- Node.js 20+
- Yarn 1.x

如果本机没有全局 Yarn，可使用：

```bash
npm exec --yes --package yarn@1.22.22 -- yarn install
npm run dev:all
```

## 启动

安装全部工作区依赖：

```bash
yarn install
```

同时启动 Mock API 和前端：

```bash
yarn dev:all
```

- 前端：http://localhost:8888
- Mock API：http://127.0.0.1:3010
- 健康检查：http://127.0.0.1:3010/health

也可以分别运行：

```bash
yarn dev:mock
yarn dev
```

## 演示登录

- 用户名：`admin`
- 密码：`123456`
- 验证码：`1234`

## API 约定

所有页面只能调用 `src/api` 中的函数，Mock 和未来真实后端使用同一接口：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

开发环境通过 `.env.development` 将 `/dev` 请求代理到 `http://127.0.0.1:3010`。接入真实后端时，只修改环境地址，不在页面中增加 Mock 分支。

## 验证

```bash
yarn mock:check
yarn build
```

没有全局 Yarn 时，验证命令可对应改为 `npm run mock:check` 和 `npm run build`。

上游项目：[saithink/saiadmin-vue](https://github.com/saithink/saiadmin-vue)，MIT License。
