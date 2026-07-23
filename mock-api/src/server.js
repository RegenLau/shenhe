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
const reviewIssueTypes = [
  'dosage_error',
  'risk_warning_missing',
  'interaction_omission',
  'off_label_usage',
  'imprecise_expression'
]
const withdrawalStatuses = ['pending', 'exported']

const dataPath = fileURLToPath(new URL('../data/bootstrap.json', import.meta.url))
const fixtures = JSON.parse(readFileSync(dataPath, 'utf8'))
const workbenchPath = fileURLToPath(new URL('../data/workbench.json', import.meta.url))
const workbenchFixture = JSON.parse(readFileSync(workbenchPath, 'utf8'))
const tasksPath = fileURLToPath(new URL('../data/tasks.json', import.meta.url))
const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'))
const doctorsPath = fileURLToPath(new URL('../data/doctors.json', import.meta.url))
const doctorFixture = JSON.parse(readFileSync(doctorsPath, 'utf8'))
const doctors = buildDoctors(doctorFixture)
const reviewsPath = fileURLToPath(new URL('../data/reviews.json', import.meta.url))
const reviewFixture = JSON.parse(readFileSync(reviewsPath, 'utf8'))
const reviews = buildReviews(reviewFixture)
const withdrawalsPath = fileURLToPath(new URL('../data/withdrawals.json', import.meta.url))
const withdrawals = JSON.parse(readFileSync(withdrawalsPath, 'utf8'))
workbenchFixture.doctors.total = doctors.length
workbenchFixture.doctors.active = doctors.filter(
  (doctor) => doctor.account_status === 'active'
).length
workbenchFixture.doctors.pending_activation = doctors.filter(
  (doctor) => doctor.account_status === 'pending_activation'
).length
workbenchFixture.reviews.total = reviews.length
workbenchFixture.reviews.approved = reviews.filter(
  (review) => review.result === 'approved'
).length
workbenchFixture.reviews.rejected = reviews.filter(
  (review) => review.result === 'rejected'
).length
syncWithdrawalWorkbench()
const importPreviews = new Map()
let nextTaskId = Math.max(...tasks.map((task) => task.id)) + 1
let nextDoctorId = Math.max(...doctors.map((doctor) => doctor.id)) + 1

app.use(cors())
app.use(express.json({ limit: '12mb' }))
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

function formatDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  ].join(' ')
}

function buildDoctors(fixture = {}) {
  const records = Array.isArray(fixture.records)
    ? fixture.records.map((record) => ({ ...record }))
    : []
  const total = Math.max(Number(fixture.total) || records.length, records.length)
  const activeTarget = Math.min(Number(fixture.active_count) || 0, total)
  const existingIds = new Set(records.map((record) => record.id))
  let activeRemaining = Math.max(
    activeTarget - records.filter((record) => record.account_status === 'active').length,
    0
  )

  const surnames = [
    '林',
    '黄',
    '吴',
    '徐',
    '胡',
    '朱',
    '高',
    '郭',
    '何',
    '罗',
    '郑',
    '梁',
    '谢',
    '宋',
    '唐',
    '许',
    '韩',
    '冯',
    '邓',
    '曹'
  ]
  const givenNames = ['雨欣', '浩然', '文博', '思远', '晓彤', '嘉宁', '子涵', '雅雯']
  const hospitals = [
    '北京市朝阳医院',
    '上海市第六人民医院',
    '广东省中医院',
    '四川省人民医院',
    '浙江省人民医院',
    '江苏省人民医院'
  ]
  const departments = ['心内科', '内分泌科', '呼吸内科', '消化内科', '神经内科', '肾内科']
  const titles = ['主治医师', '副主任医师', '主任医师']
  const pad = (value) => String(value).padStart(2, '0')

  for (let id = 1; id <= total; id += 1) {
    if (existingIds.has(id)) continue

    const accountStatus = activeRemaining > 0 ? 'active' : 'pending_activation'
    if (accountStatus === 'active') activeRemaining -= 1

    const nameIndex = id - 1
    const day = ((id - 9) % 28) + 1
    const hour = 8 + (id % 9)
    const minute = (id * 7) % 60
    const createTime = `2026-06-${pad(day)} ${pad(hour)}:${pad(minute)}:00`
    const isCertificationPending = id >= 9 && id <= 18
    let certificationStatus = 'approved'
    if (accountStatus === 'pending_activation' || id === 20) {
      certificationStatus = 'unsubmitted'
    } else if (isCertificationPending) {
      certificationStatus = 'pending'
    } else if (id === 19) {
      certificationStatus = 'rejected'
    }

    records.push({
      id,
      name: `${surnames[nameIndex % surnames.length]}${
        givenNames[Math.floor(nameIndex / surnames.length) % givenNames.length]
      }`,
      phone: `13800138${String(id).padStart(3, '0')}`,
      hospital: accountStatus === 'active' ? hospitals[id % hospitals.length] : '待补充',
      department:
        accountStatus === 'active' ? departments[id % departments.length] : '待补充',
      title: accountStatus === 'active' ? titles[id % titles.length] : '待补充',
      account_status: accountStatus,
      certification_status: certificationStatus,
      account_source:
        accountStatus === 'active'
          ? ['import', 'manual', 'mini_program'][id % 3]
          : id % 4 === 0
            ? 'manual'
            : 'import',
      create_time: createTime,
      activation_time:
        accountStatus === 'active'
          ? `2026-06-${pad(day)} ${pad(hour + 1)}:${pad(minute)}:00`
          : null,
      last_login_time:
        accountStatus === 'active'
          ? `2026-07-${pad((id % 22) + 1)} ${pad(9 + (id % 9))}:${pad(minute)}:00`
          : null
    })
  }

  return records.sort((left, right) => left.id - right.id)
}

function parseMockDateTime(value) {
  const [datePart, timePart = '00:00:00'] = String(value).split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

function formatMockDateTime(timestamp) {
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')

  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
      date.getUTCSeconds()
    )}`
  ].join(' ')
}

function isRejectedReview(index, total, rejectedTotal) {
  return (
    Math.floor(((index + 1) * rejectedTotal) / total) >
    Math.floor((index * rejectedTotal) / total)
  )
}

function buildReviews(fixture = {}) {
  const contentPool = Array.isArray(fixture.content_pool) ? fixture.content_pool : []
  const approvedComments = Array.isArray(fixture.approved_comment_templates)
    ? fixture.approved_comment_templates
    : []
  const rejectedComments = fixture.rejected_comment_templates || {}
  const rejectionCounts = fixture.rejection_counts_by_task || {}
  const defaultRejectionRate = Number(fixture.default_rejection_rate) || 0.15
  const generatedUntil = parseMockDateTime(fixture.generated_until)
  const records = []
  let reviewId = 1

  tasks
    .slice()
    .sort((left, right) => left.id - right.id)
    .forEach((task) => {
      const completedCount = Math.max(Number(task.completed_count) || 0, 0)
      if (completedCount === 0) return

      const doctor = doctors.find((item) => item.id === task.doctor_id)
      const configuredRejectedCount = Number(rejectionCounts[task.task_no])
      const rejectedCount = Math.min(
        completedCount,
        Math.max(
          Number.isFinite(configuredRejectedCount)
            ? configuredRejectedCount
            : Math.round(completedCount * defaultRejectionRate),
          0
        )
      )
      const startTime = parseMockDateTime(task.start_time || task.create_time)
      const endTime = task.complete_time
        ? parseMockDateTime(task.complete_time)
        : generatedUntil
      const timeRange = Math.max(endTime - startTime, 0)

      for (let index = 0; index < completedCount; index += 1) {
        const content = contentPool[(task.id * 3 + index) % contentPool.length]
        const rejected = isRejectedReview(index, completedCount, rejectedCount)
        const issueType = rejected
          ? reviewIssueTypes[(task.id + index) % reviewIssueTypes.length]
          : null
        const commentPool = rejected
          ? rejectedComments[issueType]
          : approvedComments
        const reviewTime = formatMockDateTime(
          startTime + Math.floor((timeRange * (index + 1)) / (completedCount + 1))
        )

        records.push({
          id: reviewId,
          review_no: `SH${reviewTime.slice(0, 10).replaceAll('-', '')}${String(
            reviewId
          ).padStart(6, '0')}`,
          task_id: task.id,
          task_no: task.task_no,
          doctor_id: task.doctor_id,
          doctor_name: doctor?.name || task.doctor_name,
          doctor_phone: doctor?.phone || task.doctor_phone,
          hospital: doctor?.hospital || task.hospital,
          department: doctor?.department || task.department,
          drug_name: content.drug_name,
          drug_type: content.drug_type,
          disease_type: content.disease_type,
          question: content.question,
          answer: {
            suggestion: content.answer.suggestion,
            dosage: content.answer.dosage,
            precautions: [...content.answer.precautions],
            interaction: content.answer.interaction,
            warning: content.answer.warning
          },
          result: rejected ? 'rejected' : 'approved',
          issue_type: issueType,
          review_comment: commentPool[(task.id + index) % commentPool.length],
          review_time: reviewTime
        })
        reviewId += 1
      }
    })

  return records
}

function summarizeWithdrawals(records = []) {
  return records.reduce(
    (summary, withdrawal) => {
      const amountCent = Number(withdrawal.amount_cent) || 0
      summary.total_count += 1
      summary.total_amount_cent += amountCent

      if (withdrawal.export_status === 'pending') {
        summary.pending_count += 1
        summary.pending_amount_cent += amountCent
      }

      if (withdrawal.export_status === 'exported') {
        summary.exported_count += 1
        summary.exported_amount_cent += amountCent
      }

      return summary
    },
    {
      total_count: 0,
      total_amount_cent: 0,
      pending_count: 0,
      pending_amount_cent: 0,
      exported_count: 0,
      exported_amount_cent: 0
    }
  )
}

function syncWithdrawalWorkbench() {
  const withdrawalSummary = summarizeWithdrawals(withdrawals)
  const accruedAmountCent = tasks
    .filter((task) => task.status === 'completed')
    .reduce((total, task) => total + Number(task.total_reward_cent || 0), 0)
  const todoIndex = workbenchFixture.todos.findIndex(
    (todo) => todo.id === 'withdrawal_pending'
  )

  workbenchFixture.settlement.accrued_amount_cent = accruedAmountCent
  workbenchFixture.settlement.withdrawable_amount_cent = Math.max(
    accruedAmountCent - withdrawalSummary.total_amount_cent,
    0
  )
  workbenchFixture.settlement.pending_withdrawal_amount_cent =
    withdrawalSummary.pending_amount_cent
  workbenchFixture.settlement.pending_export_amount_cent =
    withdrawalSummary.pending_amount_cent
  workbenchFixture.settlement.exported_amount_cent =
    withdrawalSummary.exported_amount_cent

  if (withdrawalSummary.pending_count === 0) {
    if (todoIndex >= 0) workbenchFixture.todos.splice(todoIndex, 1)
    return
  }

  const withdrawalTodo = {
    id: 'withdrawal_pending',
    title: '提现数据待导出',
    description: `${withdrawalSummary.pending_count} 笔提现申请待导出并提交基金会。`,
    count: withdrawalSummary.pending_count,
    level: 'warning'
  }

  if (todoIndex >= 0) {
    workbenchFixture.todos[todoIndex] = {
      ...workbenchFixture.todos[todoIndex],
      ...withdrawalTodo
    }
    return
  }

  workbenchFixture.todos.push(withdrawalTodo)
}

function maskPhone(value) {
  const phone = String(value || '')
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function maskIdCard(value) {
  const idCard = String(value || '')
  if (idCard.length < 10) return idCard
  return `${idCard.slice(0, 6)}********${idCard.slice(-4)}`
}

function maskBankCard(value) {
  const bankCard = String(value || '')
  if (bankCard.length <= 4) return bankCard
  return `**** **** **** ${bankCard.slice(-4)}`
}

function getWithdrawalSourceTasks(withdrawal) {
  const task = tasks.find((item) => item.id === withdrawal.source_task_id)

  return [
    {
      task_no: withdrawal.source_task_no,
      review_count: Number(withdrawal.source_review_count) || 0,
      reward_amount_cent: Number(withdrawal.amount_cent) || 0,
      completed_at: task?.complete_time || null
    }
  ]
}

function toPublicWithdrawal(withdrawal, includeSourceTasks = false) {
  const sourceTasks = getWithdrawalSourceTasks(withdrawal)
  const doctor = doctors.find((item) => item.id === withdrawal.doctor_id)
  const result = {
    id: withdrawal.id,
    withdrawal_no: withdrawal.withdrawal_no,
    status: withdrawal.export_status,
    applied_at: withdrawal.apply_time,
    exported_at: withdrawal.export_time,
    doctor_id: withdrawal.doctor_id,
    doctor_name: withdrawal.doctor_name,
    payee_name: withdrawal.doctor_name,
    hospital: doctor?.hospital || null,
    department: doctor?.department || null,
    doctor_phone_masked: maskPhone(withdrawal.doctor_phone),
    id_card_masked: maskIdCard(withdrawal.id_card_no),
    bank_name: withdrawal.bank_name,
    bank_card_masked: maskBankCard(withdrawal.bank_card_no),
    amount_cent: Number(withdrawal.amount_cent) || 0,
    source_task_count: sourceTasks.length,
    source_review_count: sourceTasks.reduce(
      (total, sourceTask) => total + sourceTask.review_count,
      0
    )
  }

  if (includeSourceTasks) {
    result.source_tasks = sourceTasks
  }

  return result
}

function escapeCsvCell(value) {
  if (value?.type === 'excelText') {
    const exactText = String(value.value ?? '').replaceAll('"', '""')
    return `"=""${exactText}"""`
  }

  const originalText = String(value ?? '')
  const text = /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(originalText)
    ? `'${originalText}`
    : originalText
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function toExcelText(value, pattern) {
  const text = String(value ?? '')
  return pattern.test(text) ? { type: 'excelText', value: text } : text
}

function parseCsv(content) {
  const text = String(content || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field.trim())
      field = ''
    } else if (character === '\n') {
      row.push(field.trim())
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') {
      field += character
    }
  }

  if (quoted) throw new Error('CSV_QUOTES_NOT_CLOSED')

  row.push(field.trim())
  if (row.some((value) => value !== '')) rows.push(row)
  return rows
}

function hydrateTask(task) {
  const doctor = doctors.find((item) => item.id === task.doctor_id)
  if (!doctor) return { ...task }

  return {
    ...task,
    doctor_name: doctor.name,
    doctor_phone: doctor.phone,
    hospital: doctor.hospital,
    department: doctor.department,
    account_status: doctor.account_status
  }
}

function hydrateDoctor(doctor, includeTasks = false) {
  const doctorTasks = tasks
    .filter((task) => task.doctor_id === doctor.id)
    .map(hydrateTask)
    .sort((left, right) => right.id - left.id)
  const taskCount = doctorTasks.length
  const assignedItemCount = doctorTasks.reduce(
    (total, task) => total + Number(task.item_count || 0),
    0
  )
  const completedItemCount = doctorTasks.reduce(
    (total, task) => total + Number(task.completed_count || 0),
    0
  )
  const accruedRewardCent = doctorTasks
    .filter((task) => task.status === 'completed')
    .reduce(
      (total, task) => total + Number(task.total_reward_cent || 0),
      0
    )
  const result = {
    ...doctor,
    task_count: taskCount,
    assigned_item_count: assignedItemCount,
    completed_item_count: completedItemCount,
    accrued_reward_cent: accruedRewardCent,
    last_task_time: doctorTasks[0]?.create_time || null
  }

  if (includeTasks) {
    result.recent_tasks = doctorTasks.slice(0, 5)
  }

  return result
}

function createTask(doctor, itemCount, sourceType, importBatchNo = null) {
  const id = nextTaskId
  nextTaskId += 1
  const createTime = formatDateTime()
  const datePart = createTime.slice(0, 10).replaceAll('-', '')

  return {
    id,
    task_no: `RW${datePart}${String(id).padStart(4, '0')}`,
    doctor_id: doctor.id,
    doctor_name: doctor.name,
    doctor_phone: doctor.phone,
    hospital: doctor.hospital,
    department: doctor.department,
    account_status: doctor.account_status,
    source_type: sourceType,
    import_batch_no: importBatchNo,
    item_count: itemCount,
    completed_count: 0,
    unit_reward_cent: 5000,
    total_reward_cent: itemCount * 5000,
    status: 'pending',
    create_time: createTime,
    start_time: null,
    complete_time: null
  }
}

function updateWorkbench(itemCount, newDoctorCount = 0) {
  workbenchFixture.tasks.total += itemCount
  workbenchFixture.tasks.pending += itemCount

  if (newDoctorCount > 0) {
    workbenchFixture.doctors.total += newDoctorCount
    workbenchFixture.doctors.pending_activation += newDoctorCount
  }

  workbenchFixture.updated_at = formatDateTime()
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

app.use('/core/product', requireAuth)

app.get('/core/product/workbench/overview', (req, res) => {
  res.json(success(workbenchFixture))
})

app.get('/core/product/doctor/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const accountStatus =
    req.query.account_status === 'all'
      ? ''
      : String(req.query.account_status || '').trim()
  const certificationStatus =
    req.query.certification_status === 'all'
      ? ''
      : String(req.query.certification_status || '').trim()
  const allowedAccountStatuses = ['active', 'pending_activation']
  const allowedCertificationStatuses = ['unsubmitted', 'pending', 'approved', 'rejected']

  if (accountStatus && !allowedAccountStatuses.includes(accountStatus)) {
    res.json(failure(422, '账号状态筛选值无效'))
    return
  }

  if (
    certificationStatus &&
    !allowedCertificationStatuses.includes(certificationStatus)
  ) {
    res.json(failure(422, '认证状态筛选值无效'))
    return
  }

  const filteredDoctors = doctors
    .map((doctor) => hydrateDoctor(doctor))
    .filter((doctor) => {
      if (accountStatus && doctor.account_status !== accountStatus) return false
      if (
        certificationStatus &&
        doctor.certification_status !== certificationStatus
      ) {
        return false
      }
      if (!keyword) return true

      return [
        doctor.name,
        doctor.phone,
        doctor.hospital,
        doctor.department,
        doctor.title
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((left, right) => {
      if (left.task_count !== right.task_count) {
        return right.task_count - left.task_count
      }
      return String(right.create_time).localeCompare(String(left.create_time))
    })

  res.json(success(paginate(filteredDoctors, req.query)))
})

app.get('/core/product/doctor/read', (req, res) => {
  const id = Number(req.query.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的医生 ID'))
    return
  }

  const doctor = doctors.find((item) => item.id === id)

  if (!doctor) {
    res.json(failure(404, '未找到对应医生'))
    return
  }

  res.json(success(hydrateDoctor(doctor, true)))
})

app.get('/core/product/review/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const result =
    req.query.result === 'all' ? '' : String(req.query.result || '').trim()
  const issueType =
    req.query.issue_type === 'all'
      ? ''
      : String(req.query.issue_type || '').trim()
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)

  if (result && !['approved', 'rejected'].includes(result)) {
    res.json(failure(422, '审核结果筛选值无效'))
    return
  }

  if (issueType && !reviewIssueTypes.includes(issueType)) {
    res.json(failure(422, '问题类型筛选值无效'))
    return
  }

  if (!Number.isInteger(page) || page <= 0) {
    res.json(failure(422, '页码必须是正整数'))
    return
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    res.json(failure(422, '每页条数必须是正整数'))
    return
  }

  const filteredReviews = reviews
    .filter((review) => {
      if (result && review.result !== result) return false
      if (issueType && review.issue_type !== issueType) return false
      if (!keyword) return true

      return [
        review.review_no,
        review.task_no,
        review.doctor_name,
        review.doctor_phone,
        review.hospital,
        review.department,
        review.drug_name,
        review.drug_type,
        review.disease_type,
        review.question
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
    .sort(
      (left, right) =>
        right.review_time.localeCompare(left.review_time) || right.id - left.id
    )

  res.json(success(paginate(filteredReviews, { page, limit })))
})

app.get('/core/product/review/read', (req, res) => {
  const id = Number(req.query.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的审核记录 ID'))
    return
  }

  const review = reviews.find((item) => item.id === id)

  if (!review) {
    res.json(failure(404, '未找到对应审核记录'))
    return
  }

  res.json(success(review))
})

app.get('/core/product/withdrawal/summary', (req, res) => {
  res.json(success(summarizeWithdrawals(withdrawals)))
})

app.get('/core/product/withdrawal/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status = req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)

  if (status && !withdrawalStatuses.includes(status)) {
    res.json(failure(422, '导出状态筛选值无效'))
    return
  }

  if (!Number.isInteger(page) || page <= 0) {
    res.json(failure(422, '页码必须是正整数'))
    return
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    res.json(failure(422, '每页条数必须是正整数'))
    return
  }

  const filteredWithdrawals = withdrawals
    .filter((withdrawal) => {
      if (status && withdrawal.export_status !== status) return false
      if (!keyword) return true

      return [
        withdrawal.withdrawal_no,
        withdrawal.doctor_name,
        withdrawal.doctor_phone,
        withdrawal.bank_name,
        withdrawal.source_task_no
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
    .sort(
      (left, right) =>
        right.apply_time.localeCompare(left.apply_time) || right.id - left.id
    )
    .map((withdrawal) => toPublicWithdrawal(withdrawal))

  res.json(success(paginate(filteredWithdrawals, { page, limit })))
})

app.get('/core/product/withdrawal/read', (req, res) => {
  const id = Number(req.query.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的提现申请 ID'))
    return
  }

  const withdrawal = withdrawals.find((item) => item.id === id)

  if (!withdrawal) {
    res.json(failure(404, '未找到对应提现申请'))
    return
  }

  res.json(success(toPublicWithdrawal(withdrawal, true)))
})

app.post('/core/product/withdrawal/export', (req, res) => {
  const pendingWithdrawals = withdrawals
    .filter((withdrawal) => withdrawal.export_status === 'pending')
    .sort(
      (left, right) =>
        left.apply_time.localeCompare(right.apply_time) || left.id - right.id
    )

  if (pendingWithdrawals.length === 0) {
    res.json(failure(422, '暂无待导出的提现申请'))
    return
  }

  const exportTime = formatDateTime()
  const rows = [
    [
      '申请单号',
      '申请时间',
      '姓名',
      '手机号',
      '身份证号',
      '开户行',
      '银行卡号',
      '金额(元)',
      '来源任务编号',
      '审核条数'
    ],
    ...pendingWithdrawals.map((withdrawal) => {
      const sourceTasks = getWithdrawalSourceTasks(withdrawal)

      return [
        withdrawal.withdrawal_no,
        withdrawal.apply_time,
        withdrawal.doctor_name,
        toExcelText(withdrawal.doctor_phone, /^\d{11}$/),
        toExcelText(withdrawal.id_card_no, /^\d{17}[\dXx]$/),
        withdrawal.bank_name,
        toExcelText(withdrawal.bank_card_no, /^\d{16,19}$/),
        (Number(withdrawal.amount_cent || 0) / 100).toFixed(2),
        sourceTasks.map((sourceTask) => sourceTask.task_no).join('、'),
        sourceTasks.reduce(
          (total, sourceTask) => total + sourceTask.review_count,
          0
        )
      ]
    })
  ]
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const exportBatch = exportTime.replaceAll(/[-: ]/g, '')

  pendingWithdrawals.forEach((withdrawal) => {
    withdrawal.export_status = 'exported'
    withdrawal.export_time = exportTime
  })
  syncWithdrawalWorkbench()

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="foundation-withdrawals-${exportBatch}.csv"`
  )
  res.send(`\uFEFF${csv}`)
})

app.get('/core/product/task/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status = req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const sourceType =
    req.query.source_type === 'all' ? '' : String(req.query.source_type || '').trim()
  const allowedStatuses = ['pending', 'in_progress', 'completed']
  const allowedSourceTypes = ['manual', 'import']

  if (status && !allowedStatuses.includes(status)) {
    res.json(failure(422, '任务状态筛选值无效'))
    return
  }

  if (sourceType && !allowedSourceTypes.includes(sourceType)) {
    res.json(failure(422, '任务来源筛选值无效'))
    return
  }

  const filteredTasks = tasks
    .map(hydrateTask)
    .filter((task) => {
      if (status && task.status !== status) return false
      if (sourceType && task.source_type !== sourceType) return false
      if (!keyword) return true

      return [
        task.task_no,
        task.doctor_name,
        task.doctor_phone,
        task.hospital,
        task.department,
        task.import_batch_no
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((left, right) => right.id - left.id)

  res.json(success(paginate(filteredTasks, req.query)))
})

app.get('/core/product/task/read', (req, res) => {
  const id = Number(req.query.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的任务 ID'))
    return
  }

  const task = tasks.find((item) => item.id === id)

  if (!task) {
    res.json(failure(404, '未找到对应任务'))
    return
  }

  res.json(success(hydrateTask(task)))
})

app.get('/core/product/task/doctorOptions', (req, res) => {
  const options = doctors
    .map((doctor) => ({ ...doctor }))
    .sort((left, right) => left.id - right.id)

  res.json(success(options))
})

app.post('/core/product/task/save', (req, res) => {
  const doctorName = String(req.body?.doctor_name || '').trim()
  const doctorPhone = String(req.body?.doctor_phone || '').trim()
  const itemCount = Number(req.body?.item_count)

  if (!doctorName) {
    res.json(failure(422, '请输入医生姓名'))
    return
  }

  if (!/^1\d{10}$/.test(doctorPhone)) {
    res.json(failure(422, '请输入有效的 11 位医生手机号'))
    return
  }

  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 1000) {
    res.json(failure(422, '任务数量须为 1 至 1000 的整数'))
    return
  }

  let doctor = doctors.find((item) => item.phone === doctorPhone)

  if (doctor && doctor.name !== doctorName) {
    res.json(
      failure(
        422,
        `手机号 ${doctorPhone} 已绑定医生“${doctor.name}”，请核对姓名后再创建任务`
      )
    )
    return
  }

  const accountCreated = !doctor

  if (!doctor) {
    const createTime = formatDateTime()
    doctor = {
      id: nextDoctorId,
      name: doctorName,
      phone: doctorPhone,
      hospital: '待补充',
      department: '待补充',
      title: '待补充',
      account_status: 'pending_activation',
      certification_status: 'unsubmitted',
      account_source: 'manual',
      create_time: createTime,
      activation_time: null,
      last_login_time: null
    }
    nextDoctorId += 1
    doctors.push(doctor)
  }

  const task = createTask(doctor, itemCount, 'manual')
  tasks.push(task)
  updateWorkbench(itemCount, accountCreated ? 1 : 0)
  res.json(
    success(
      hydrateTask(task),
      accountCreated
        ? '医生账号和任务已创建，审核内容已自动分配'
        : '任务已创建并自动分配审核内容'
    )
  )
})

app.post('/core/product/task/importPreview', (req, res) => {
  const fileName = String(req.body?.file_name || '').trim()
  const fileSize = Number(req.body?.file_size)
  const fileContent = String(req.body?.file_content || '')

  if (!fileName) {
    res.json(failure(422, '请选择要导入的名单文件'))
    return
  }

  if (!/\.csv$/i.test(fileName)) {
    res.json(failure(422, 'V1.0 名单导入仅支持 CSV 文件，请下载模板后填写'))
    return
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || !fileContent.trim()) {
    res.json(failure(422, '无法读取文件大小，请重新选择文件'))
    return
  }

  if (
    fileSize > 10 * 1024 * 1024 ||
    Buffer.byteLength(fileContent, 'utf8') > 10 * 1024 * 1024
  ) {
    res.json(failure(422, '名单文件不能超过 10 MB'))
    return
  }

  let csvRows
  try {
    csvRows = parseCsv(fileContent)
  } catch {
    res.json(failure(422, 'CSV 文件格式不正确，请检查引号和换行后重试'))
    return
  }

  if (csvRows.length < 2) {
    res.json(failure(422, '名单中没有可导入的数据'))
    return
  }

  const header = csvRows[0]
  const nameIndex = header.findIndex((value) => ['姓名', '医生姓名'].includes(value))
  const phoneIndex = header.indexOf('手机号')
  const countIndex = header.findIndex((value) => ['任务数量', '任务数'].includes(value))

  if ([nameIndex, phoneIndex, countIndex].some((index) => index < 0)) {
    res.json(failure(422, '模板字段不完整，必须包含姓名、手机号和任务数量'))
    return
  }

  const phoneRows = new Map()
  csvRows.slice(1).forEach((values, index) => {
    const phone = String(values[phoneIndex] || '').trim()
    if (!phone) return
    const rowNumbers = phoneRows.get(phone) || []
    rowNumbers.push(index + 2)
    phoneRows.set(phone, rowNumbers)
  })

  const rows = csvRows.slice(1).map((values, index) => {
    const rowNo = index + 2
    const doctorName = String(values[nameIndex] || '').trim()
    const doctorPhone = String(values[phoneIndex] || '').trim()
    const itemCountText = String(values[countIndex] || '').trim()
    const itemCount = Number(itemCountText)
    const errors = []

    if (!doctorName) {
      errors.push('医生姓名不能为空')
    } else if (doctorName.length > 20) {
      errors.push('医生姓名不能超过 20 个字符')
    }

    if (!/^1\d{10}$/.test(doctorPhone)) {
      errors.push('手机号须为 11 位数字')
    }

    if (!/^\d+$/.test(itemCountText) || !Number.isInteger(itemCount) || itemCount < 1) {
      errors.push('任务数量须为大于 0 的整数')
    } else if (itemCount > 1000) {
      errors.push('单个医生任务数量不能超过 1000')
    }

    if (doctorPhone && (phoneRows.get(doctorPhone)?.length || 0) > 1) {
      errors.push('手机号在名单中重复')
    }

    const doctor = doctors.find((item) => item.phone === doctorPhone)
    if (doctor && doctor.name !== doctorName) {
      errors.push(`手机号已绑定医生“${doctor.name}”`)
    }

    const valid = errors.length === 0
    const accountAction = doctor ? 'reuse' : 'create'

    return {
      row_no: rowNo,
      doctor_name: doctorName,
      doctor_phone: doctorPhone,
      item_count: Number.isFinite(itemCount) ? itemCount : 0,
      total_reward_cent: valid ? itemCount * 5000 : 0,
      account_action: accountAction,
      validation_status: valid ? 'valid' : 'invalid',
      validation_message: valid
        ? accountAction === 'reuse'
          ? '校验通过，将复用已有账号'
          : '校验通过，将创建医生账号'
        : errors.join('；')
    }
  })

  const validRows = rows.filter((row) => row.validation_status === 'valid')
  const previewId = `PV${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  const summary = {
    total_rows: rows.length,
    valid_rows: validRows.length,
    error_rows: rows.length - validRows.length,
    new_account_count: validRows.filter((row) => row.account_action === 'create').length,
    reused_account_count: validRows.filter((row) => row.account_action === 'reuse').length,
    task_count: validRows.length,
    total_item_count: validRows.reduce((total, row) => total + row.item_count, 0),
    total_reward_cent: validRows.reduce((total, row) => total + row.total_reward_cent, 0)
  }

  importPreviews.set(previewId, {
    file_name: fileName,
    rows,
    summary
  })

  res.json(
    success({
      preview_id: previewId,
      file_name: fileName,
      summary,
      rows
    })
  )
})

app.post('/core/product/task/importConfirm', (req, res) => {
  const previewId = String(req.body?.preview_id || '').trim()

  if (!previewId) {
    res.json(failure(422, '缺少导入预览标识，请重新上传名单'))
    return
  }

  const preview = importPreviews.get(previewId)

  if (!preview) {
    res.json(failure(404, '导入预览不存在或已完成，请重新上传名单'))
    return
  }

  if (preview.summary.error_rows > 0) {
    res.json(failure(422, '名单仍有校验错误，请修正后重新上传'))
    return
  }

  const accountConflict = preview.rows.find((row) => {
    const doctor = doctors.find((item) => item.phone === row.doctor_phone)
    return doctor && doctor.name !== row.doctor_name
  })

  if (accountConflict) {
    res.json(
      failure(
        422,
        `手机号 ${accountConflict.doctor_phone} 的账号信息已变化，请重新校验名单`
      )
    )
    return
  }

  const batchNo = `DR${formatDateTime().slice(0, 10).replaceAll('-', '')}${String(
    Date.now()
  ).slice(-5)}`
  const createdTasks = []
  let newDoctorCount = 0

  preview.rows.forEach((row) => {
    let doctor = doctors.find((item) => item.phone === row.doctor_phone)

    if (!doctor) {
      const createTime = formatDateTime()
      doctor = {
        id: nextDoctorId,
        name: row.doctor_name,
        phone: row.doctor_phone,
        hospital: '待补充',
        department: '待补充',
        title: '待补充',
        account_status: 'pending_activation',
        certification_status: 'unsubmitted',
        account_source: 'import',
        create_time: createTime,
        activation_time: null,
        last_login_time: null
      }
      nextDoctorId += 1
      newDoctorCount += 1
      doctors.push(doctor)
    }

    const task = createTask(doctor, row.item_count, 'import', batchNo)
    tasks.push(task)
    createdTasks.push(task)
  })

  const totalItemCount = createdTasks.reduce((total, task) => total + task.item_count, 0)
  updateWorkbench(totalItemCount, newDoctorCount)
  importPreviews.delete(previewId)

  res.json(
    success(
      {
        batch_no: batchNo,
        created_account_count: newDoctorCount,
        reused_account_count: createdTasks.length - newDoctorCount,
        created_task_count: createdTasks.length,
        assigned_item_count: totalItemCount,
        total_reward_cent: createdTasks.reduce(
          (total, task) => total + task.total_reward_cent,
          0
        )
      },
      '名单导入成功，账号和任务已自动创建'
    )
  )
})

app.get('/core/product/task/template', (req, res) => {
  const csv = [
    '姓名,手机号,任务数量',
    '示例医生,13800000000,20'
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="doctor-task-import-template.csv"')
  res.send(`\uFEFF${csv}`)
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
