import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = express()
const host = process.env.MOCK_API_HOST || '127.0.0.1'
const port = Number(process.env.MOCK_API_PORT || 3010)
const accessToken = 'mock-access-token'
const refreshToken = 'mock-refresh-token'

const dataPath = fileURLToPath(new URL('../data/bootstrap.json', import.meta.url))
const fixtures = JSON.parse(readFileSync(dataPath, 'utf8'))

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

const success = (data = {}, message = 'success') => ({ code: 200, message, data })
const failure = (code, message) => ({ code, message, data: null })

function paginate(items, query = {}) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.max(Number(query.limit) || 10, 1)
  const start = (page - 1) * limit

  return {
    data: items.slice(start, start + limit),
    total: items.length,
    current_page: page,
    per_page: limit
  }
}

function captchaImage() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="36"><rect width="96" height="36" rx="4" fill="#f2f3f5"/><text x="25" y="24" font-family="Arial" font-size="18" font-weight="700" fill="#165dff">1234</text></svg>'
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function requireAuth(req, res, next) {
  if (req.get('Authorization') !== `Bearer ${accessToken}`) {
    res.json(failure(401, '登录状态已过期，请重新登录'))
    return
  }
  next()
}

app.get('/health', (req, res) => {
  res.json(success({ status: 'ok', service: 'saiadmin-mock-api' }))
})

app.get('/core/captcha', (req, res) => {
  res.json(success({ uuid: 'mock-captcha', image: captchaImage() }))
})

app.post('/core/login', (req, res) => {
  const { username, password, code } = req.body || {}

  if (code !== '1234') {
    res.json(failure(422, '验证码错误，请输入 1234'))
    return
  }

  if (username !== 'admin' || password !== '123456') {
    res.json(failure(422, '用户名或密码错误'))
    return
  }

  res.json(
    success({
      token_type: 'Bearer',
      expires_in: 28800,
      access_token: accessToken,
      refresh_token: refreshToken
    })
  )
})

app.post('/core/logout', requireAuth, (req, res) => {
  res.json(success({}, '已退出登录'))
})

app.use('/core/system', requireAuth)

app.get('/core/system/user', (req, res) => {
  res.json(success(fixtures.userInfo))
})

app.get('/core/system/dictAll', (req, res) => {
  res.json(success(fixtures.dictionaries))
})

app.get('/core/system/statistics', (req, res) => {
  res.json(success(fixtures.statistics))
})

app.get('/core/system/loginChart', (req, res) => {
  res.json(success(fixtures.loginChart))
})

app.get('/core/system/getLoginLogList', (req, res) => {
  res.json(success(paginate(fixtures.loginLogs, req.query)))
})

app.get('/core/system/getOperationLogList', (req, res) => {
  res.json(success(paginate(fixtures.operationLogs, req.query)))
})

app.get('/core/system/notice', (req, res) => {
  res.json(
    success({
      data: fixtures.notices,
      total: fixtures.notices.length,
      current_page: 1,
      per_page: fixtures.notices.length
    })
  )
})

app.get('/core/system/clearAllCache', (req, res) => {
  res.json(success({}, '缓存已清理'))
})

app.use((req, res) => {
  res.status(404).json(failure(404, `Mock route not found: ${req.method} ${req.path}`))
})

app.use((error, req, res, next) => {
  console.error(error)
  res.status(500).json(failure(500, 'Mock API internal error'))
})

app.listen(port, host, () => {
  console.log(`Mock API listening on http://${host}:${port}`)
})
