import cors from 'cors'
import ExcelJS from 'exceljs'
import express from 'express'
import morgan from 'morgan'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  UNIT_REWARD_CENT,
  buildDepartmentOptions,
  buildDrugCatalog,
  buildQuestionBank,
  evaluateRiskDetails,
  planQuestionAllocation,
  recordQuestionAllocation,
  resolveDepartmentSelection,
  resolveDrugSelection,
  resolveQuestionAuditActionLabel,
  resolveRiskTagNames,
  summarizeQuestionBank
} from './question-bank.js'

const app = express()
const host = process.env.MOCK_API_HOST || '127.0.0.1'
const port = Number(process.env.MOCK_API_PORT || 3010)
const accessToken = 'mock-access-token'
const refreshToken = 'mock-refresh-token'
const reviewIssueTypes = [
  'content_inaccurate',
  'expression_nonstandard',
  'info_incomplete',
  'safety_risk',
  'other'
]
const reviewIssueTypeLabels = {
  content_inaccurate: '内容不准确',
  expression_nonstandard: '表述不规范',
  info_incomplete: '信息不完整',
  safety_risk: '存在安全风险',
  other: '其他'
}
const withdrawalSettlementStatuses = ['pending', 'exported', 'settled']
const settlementBatchStatuses = ['pending', 'exported', 'partial', 'settled', 'blocked']
const monthlySettlementOrderStatuses = [
  'pending_export',
  'exported',
  'paid',
  'payment_failed'
]
const monthlySettlementCycleStatuses = [
  'not_generated',
  'pending_export',
  'exported',
  'partial',
  'settled'
]
const settlementHistoryStatuses = [
  ...new Set([
    ...monthlySettlementCycleStatuses,
    ...monthlySettlementOrderStatuses
  ])
]
const paymentAccountStatuses = ['complete', 'incomplete', 'missing']
const doctorAccountStatuses = ['pending_activation', 'active', 'disabled']
const doctorCertificationStatuses = [
  'unsubmitted',
  'pending',
  'approved',
  'rejected'
]
const doctorCertificateTypes = ['医师资格证', '医师执业证书']
const doctorConfigTypes = ['hospital', 'department', 'position']
const questionLifecycleStatuses = ['draft', 'available', 'disabled']
const disclosureDocumentMaxSize = 10 * 1024 * 1024
const doctorConfigTypeLabels = {
  hospital: '医院',
  department: '科室',
  position: '职称'
}

const dataPath = fileURLToPath(new URL('../data/bootstrap.json', import.meta.url))
const fixtures = JSON.parse(readFileSync(dataPath, 'utf8'))
const workbenchPath = fileURLToPath(new URL('../data/workbench.json', import.meta.url))
const workbenchFixture = JSON.parse(readFileSync(workbenchPath, 'utf8'))
const tasksPath = fileURLToPath(new URL('../data/tasks.json', import.meta.url))
const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'))
const doctorsPath = fileURLToPath(new URL('../data/doctors.json', import.meta.url))
const doctorFixture = JSON.parse(readFileSync(doctorsPath, 'utf8'))
const doctors = buildDoctors(doctorFixture)
const doctorCertificationsPath = fileURLToPath(
  new URL('../data/doctor-certifications.json', import.meta.url)
)
const doctorCertificationsFixture = JSON.parse(
  readFileSync(doctorCertificationsPath, 'utf8')
)
const doctorCertifications = buildDoctorCertifications(
  doctorCertificationsFixture,
  doctors
)
const reviewsPath = fileURLToPath(new URL('../data/reviews.json', import.meta.url))
const reviewFixture = JSON.parse(readFileSync(reviewsPath, 'utf8'))
const withdrawalsPath = fileURLToPath(new URL('../data/withdrawals.json', import.meta.url))
const withdrawals = JSON.parse(readFileSync(withdrawalsPath, 'utf8'))
const doctorConfigPath = fileURLToPath(
  new URL('../data/doctor-config.json', import.meta.url)
)
let doctorConfigRows = JSON.parse(readFileSync(doctorConfigPath, 'utf8'))
const projectOrgPath = fileURLToPath(
  new URL('../data/project-org.json', import.meta.url)
)
const projectOrgFixture = JSON.parse(readFileSync(projectOrgPath, 'utf8'))
const projectOrgRows = {
  foundation: projectOrgFixture.foundations.map((item) => ({ ...item })),
  project: projectOrgFixture.projects.map((item) => ({ ...item })),
  identifier: projectOrgFixture.identifiers.map((item) => ({ ...item }))
}
const disclosureDocuments = new Map()
const disclosureDocumentsByFileId = new Map()
projectOrgRows.project.forEach((project) => {
  if (!project.disclosure_document_url) return
  const fileId = String(project.disclosure_document_url).match(
    /\/disclosures\/([^/]+)\//
  )?.[1]
  if (!fileId) return

  const document = {
    file_id: fileId,
    url: project.disclosure_document_url,
    name: project.disclosure_document_name,
    size: project.disclosure_document_size,
    upload_time: project.disclosure_document_upload_time,
    buffer: null
  }
  disclosureDocuments.set(document.url, document)
  disclosureDocumentsByFileId.set(fileId, document)
})
const questionBankPath = fileURLToPath(
  new URL('../data/question-bank.json', import.meta.url)
)
const questionBankFixture = JSON.parse(readFileSync(questionBankPath, 'utf8'))
const drugCatalogRows = buildDrugCatalog(questionBankFixture)
const questionBankRows = buildQuestionBank(questionBankFixture)
const taskItems = buildInitialTaskItems(tasks, questionBankRows)
syncInitialWithdrawalAmounts(withdrawals, taskItems)
// Submitted review records freeze the question-bank metadata available at submission time.
const reviews = buildReviews(reviewFixture, { taskItems })
const doctorPaymentAccounts = buildDoctorPaymentAccounts(doctors, withdrawals)
const pointLedger = buildPointLedger(reviews)
const monthlySettlementCycles = []
const monthlySettlementOrders = []
const monthlySettlementExports = new Map()
const monthlySettlementImportPreviews = new Map()
const monthlySettlementAuditLogs = []
const monthlySettlementJobLogs = []
let nextMonthlySettlementCycleId = 1
let nextMonthlySettlementOrderId = 1
let nextMonthlySettlementExportId = 1
let nextMonthlySettlementJobLogId = 1
initializeMonthlySettlementState()
workbenchFixture.doctors.total = doctors.length
workbenchFixture.doctors.active = doctors.filter(
  (doctor) => doctor.account_status === 'active'
).length
workbenchFixture.doctors.pending_activation = doctors.filter(
  (doctor) => doctor.account_status === 'pending_activation'
).length
workbenchFixture.doctors.disabled = doctors.filter(
  (doctor) => doctor.account_status === 'disabled'
).length
workbenchFixture.reviews.total = reviews.length
workbenchFixture.reviews.approved = reviews.filter(
  (review) => review.result === 'approved'
).length
workbenchFixture.reviews.rejected = reviews.filter(
  (review) => review.result === 'rejected'
).length
syncWithdrawalWorkbench()
syncMonthlySettlementWorkbench()
syncCertificationWorkbench()
const importPreviews = new Map()
const withdrawalSettlementPreviews = new Map()
let nextTaskId = Math.max(...tasks.map((task) => task.id)) + 1
let nextDoctorId = Math.max(...doctors.map((doctor) => doctor.id)) + 1
let nextDoctorConfigId =
  doctorConfigRows.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) +
  1
const projectOrgTypeLabels = {
  foundation: '基金会',
  project: '项目',
  identifier: '项目标识'
}
const nextProjectOrgId = Object.fromEntries(
  Object.keys(projectOrgRows).map((type) => [
    type,
    projectOrgRows[type].reduce(
      (maxId, item) => Math.max(maxId, Number(item.id) || 0),
      0
    ) + 1
  ])
)
let nextQuestionId =
  questionBankRows.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) +
  1
let nextTaskItemId = taskItems.length + 1

app.use(cors())
app.use(express.json({ limit: '16mb' }))
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

function isValidDateTimeText(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return false
  const [datePart, timePart] = text.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
  )
}

function normalizeDoctorConfigPayload(payload = {}, fallbackType = '') {
  const type = String(payload.type || fallbackType).trim()
  const name = String(payload.name || '').trim()
  const region = String(payload.region || '').trim()
  const level = String(payload.level || '').trim()
  const remark = String(payload.remark || '').trim()
  const sort = Number(payload.sort)
  const status = String(payload.status || '1')

  if (!doctorConfigTypes.includes(type)) {
    return { error: '配置类型无效' }
  }

  const typeLabel = doctorConfigTypeLabels[type]
  if (!name) {
    return { error: `请输入${typeLabel}名称` }
  }
  if (name.length > 80) {
    return { error: `${typeLabel}名称不能超过 80 个字符` }
  }
  if (region.length > 50) {
    return { error: '所在地区不能超过 50 个字符' }
  }
  if (level.length > 30) {
    return { error: '医院等级不能超过 30 个字符' }
  }
  if (remark.length > 200) {
    return { error: '备注不能超过 200 个字符' }
  }
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999) {
    return { error: '显示顺序须为 0 至 9999 的整数' }
  }
  if (!['1', '2'].includes(status)) {
    return { error: '状态值无效' }
  }

  return {
    data: {
      type,
      name,
      region: type === 'hospital' ? region : '',
      level: type === 'hospital' ? level : '',
      sort,
      status,
      remark
    }
  }
}

function normalizeProjectOrgPayload(payload = {}) {
  const type = String(payload.type || '').trim()
  const name = String(payload.name || '').trim()
  const code = String(payload.code || '').trim()
  const remark = String(payload.remark || '').trim()
  const status = String(payload.status || '1')

  if (!Object.keys(projectOrgTypeLabels).includes(type)) {
    return { error: '层级类型无效' }
  }

  const typeLabel = projectOrgTypeLabels[type]
  if (!name) {
    return { error: `请输入${typeLabel}名称` }
  }
  if (name.length > 80) {
    return { error: `${typeLabel}名称不能超过 80 个字符` }
  }
  if (code.length > 40) {
    return { error: `${typeLabel}编码不能超过 40 个字符` }
  }
  if (remark.length > 200) {
    return { error: '备注不能超过 200 个字符' }
  }
  if (!['1', '2'].includes(status)) {
    return { error: '状态值无效' }
  }

  const data = { name, code, status, remark }

  if (type === 'project') {
    const foundationId = Number(payload.foundation_id)
    const foundation = projectOrgRows.foundation.find(
      (row) => row.id === foundationId
    )
    if (!foundation) {
      return { error: '所属基金会不存在或已删除，请刷新后重试' }
    }
    data.foundation_id = foundationId

    const disclosureDocumentUrl = String(
      payload.disclosure_document_url || ''
    ).trim()
    if (!disclosureDocumentUrl) {
      return { error: '请上传 PDF 格式的公示文档' }
    }
    const disclosureDocument = disclosureDocuments.get(disclosureDocumentUrl)
    if (!disclosureDocument) {
      return { error: '公示文档不存在或已失效，请重新上传 PDF 文件' }
    }
    data.disclosure_document_url = disclosureDocument.url
    data.disclosure_document_name = disclosureDocument.name
    data.disclosure_document_size = disclosureDocument.size
    data.disclosure_document_upload_time = disclosureDocument.upload_time
  }

  if (type === 'identifier') {
    const projectId = Number(payload.project_id)
    const project = projectOrgRows.project.find((row) => row.id === projectId)
    if (!project) {
      return { error: '所属项目不存在或已删除，请刷新后重试' }
    }
    data.project_id = projectId
  }

  return { data }
}

function isSameProjectOrgParent(type, row, data) {
  if (type === 'project') {
    return row.foundation_id === data.foundation_id
  }
  if (type === 'identifier') {
    return row.project_id === data.project_id
  }
  return true
}

function findProjectOrgDuplicate(type, data, excludeId = 0) {
  return projectOrgRows[type].find(
    (row) =>
      row.id !== excludeId &&
      isSameProjectOrgParent(type, row, data) &&
      row.name.toLowerCase() === data.name.toLowerCase()
  )
}

function findProjectOrgCodeDuplicate(type, data, excludeId = 0) {
  if (!data.code) {
    return undefined
  }

  return projectOrgRows[type].find(
    (row) =>
      row.id !== excludeId &&
      isSameProjectOrgParent(type, row, data) &&
      String(row.code || '').toLowerCase() === data.code.toLowerCase()
  )
}

function enrichProjectOrgRow(type, item) {
  if (type === 'foundation') {
    return {
      ...item,
      project_count: projectOrgRows.project.filter(
        (row) => row.foundation_id === item.id
      ).length
    }
  }

  if (type === 'project') {
    const foundation = projectOrgRows.foundation.find(
      (row) => row.id === item.foundation_id
    )
    return {
      ...item,
      foundation_name: foundation ? foundation.name : '',
      identifier_count: projectOrgRows.identifier.filter(
        (row) => row.project_id === item.id
      ).length
    }
  }

  const project = projectOrgRows.project.find(
    (row) => row.id === item.project_id
  )
  const foundation = project
    ? projectOrgRows.foundation.find(
        (row) => row.id === project.foundation_id
      )
    : undefined
  return {
    ...item,
    project_name: project ? project.name : '',
    foundation_name: foundation ? foundation.name : ''
  }
}

function parseMultipartFile(body, contentType = '') {
  const boundaryMatch = String(contentType).match(
    /boundary=(?:"([^"]+)"|([^;]+))/i
  )
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary || !Buffer.isBuffer(body)) return null

  const delimiter = Buffer.from(`--${boundary}`)
  let partStart = body.indexOf(delimiter)

  while (partStart >= 0) {
    partStart += delimiter.length
    if (body.subarray(partStart, partStart + 2).toString() === '--') break
    if (body.subarray(partStart, partStart + 2).toString() === '\r\n') {
      partStart += 2
    }

    const nextBoundary = body.indexOf(delimiter, partStart)
    if (nextBoundary < 0) break
    const partEnd =
      body.subarray(nextBoundary - 2, nextBoundary).toString() === '\r\n'
        ? nextBoundary - 2
        : nextBoundary
    const part = body.subarray(partStart, partEnd)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))

    if (headerEnd >= 0) {
      const headers = part.subarray(0, headerEnd).toString('utf8')
      const disposition = headers.match(/content-disposition:([^\r\n]+)/i)?.[1] || ''
      const fieldName = disposition.match(/name="([^"]+)"/i)?.[1]
      const fileName = disposition.match(/filename="([^"]*)"/i)?.[1]

      if (fieldName === 'file' && fileName) {
        return {
          name: fileName,
          mime_type:
            headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '',
          buffer: part.subarray(headerEnd + 4)
        }
      }
    }

    partStart = nextBoundary
  }

  return null
}

function safeDisclosureFileName(fileName = '') {
  return String(fileName)
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f<>:"|?*]/g, '-')
    .trim()
}

function buildMockDisclosurePdf() {
  const stream =
    'BT\n/F1 18 Tf\n72 760 Td\n(Mock public disclosure document) Tj\nET\n'
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`
  ]
  let content = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(content))
    content += object
  })
  const xrefOffset = Buffer.byteLength(content)
  content += `xref\n0 ${objects.length + 1}\n`
  content += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    content += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  content += `startxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(content)
}

function buildProjectOrgTree() {
  const identifierNodesOf = (projectId) =>
    projectOrgRows.identifier
      .filter((identifier) => identifier.project_id === projectId)
      .map((identifier) => ({
        label: identifier.name,
        value: `identifier-${identifier.id}`,
        type: 'identifier',
        id: identifier.id,
        project_id: identifier.project_id
      }))

  const projectNodesOf = (foundationId) =>
    projectOrgRows.project
      .filter((project) => project.foundation_id === foundationId)
      .map((project) => ({
        label: project.name,
        value: `project-${project.id}`,
        type: 'project',
        id: project.id,
        foundation_id: project.foundation_id,
        children: identifierNodesOf(project.id)
      }))

  return [
    {
      label: '全部基金会',
      value: 'root',
      type: 'root',
      children: projectOrgRows.foundation.map((foundation) => ({
        label: foundation.name,
        value: `foundation-${foundation.id}`,
        type: 'foundation',
        id: foundation.id,
        children: projectNodesOf(foundation.id)
      }))
    }
  ]
}

function resolveTaskOrgChain(identifierId) {
  const identifier = projectOrgRows.identifier.find(
    (row) => row.id === Number(identifierId)
  )
  if (!identifier) return null

  const project = projectOrgRows.project.find(
    (row) => row.id === identifier.project_id
  )
  const foundation = project
    ? projectOrgRows.foundation.find((row) => row.id === project.foundation_id)
    : undefined
  if (!project || !foundation) return null

  return { foundation, project, identifier }
}

function taskOrgDisabledError({ foundation, project, identifier }) {
  if (foundation.status === '2') return '所选基金会已停用，请先启用或更换基金会'
  if (project.status === '2') return '所选项目已停用，请先启用或更换项目'
  if (identifier.status === '2') return '所选项目标识已停用，请先启用或更换标识'
  return ''
}

function buildTaskOrgOptions() {
  return projectOrgRows.foundation.map((foundation) => ({
    id: foundation.id,
    name: foundation.name,
    status: foundation.status,
    projects: projectOrgRows.project
      .filter((project) => project.foundation_id === foundation.id)
      .map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        identifiers: projectOrgRows.identifier
          .filter((identifier) => identifier.project_id === project.id)
          .map((identifier) => ({
            id: identifier.id,
            name: identifier.name,
            status: identifier.status
          }))
      }))
  }))
}

function buildDoctors(fixture = {}) {
  const records = Array.isArray(fixture.records)
    ? fixture.records.map((record) => ({
        ...record,
        training_exam_status: record.training_exam_status || 'passed',
        max_review_level: record.max_review_level || 'C',
        review_qualification_source:
          record.review_qualification_source || 'legacy_qualified_roster'
      }))
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
  const givenNameGenders = [
    'female',
    'male',
    'male',
    'male',
    'female',
    'female',
    'male',
    'female'
  ]
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
      gender:
        givenNameGenders[
          Math.floor(nameIndex / surnames.length) % givenNameGenders.length
        ],
      account_status: accountStatus,
      certification_status: certificationStatus,
      training_exam_status: 'passed',
      max_review_level: 'C',
      review_qualification_source: 'mock_qualified_roster',
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

function mockIdentityCardNumber(doctorId) {
  return `1101**********${String(1000 + Number(doctorId)).slice(-4)}`
}

function certificatePreviewImage(doctor, certification) {
  const certificateType = certification.certificate_type || '证件'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420"><rect width="720" height="420" rx="20" fill="#f7f8fa"/><rect x="24" y="24" width="672" height="372" rx="14" fill="#ffffff" stroke="#c9cdd4"/><text x="56" y="82" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#1d2129">${certificateType}附件</text><text x="56" y="118" font-family="Arial, sans-serif" font-size="18" fill="#86909c">原型示意 · 非真实证件</text><line x1="56" y1="146" x2="664" y2="146" stroke="#e5e6eb"/><text x="56" y="198" font-family="Arial, sans-serif" font-size="22" fill="#4e5969">证件姓名：${doctor.name}</text><text x="56" y="244" font-family="Arial, sans-serif" font-size="22" fill="#4e5969">执业机构：${doctor.hospital}</text><text x="56" y="290" font-family="Arial, sans-serif" font-size="22" fill="#4e5969">身份证号：${mockIdentityCardNumber(doctor.id)}</text><rect x="56" y="326" width="608" height="42" rx="8" fill="#f2f3f5"/><text x="360" y="354" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" fill="#86909c">已添加水印 · 仅用于平台人工复审</text><text x="360" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" fill="#1d2129" opacity="0.06" transform="rotate(-18 360 230)">希息药事 · 仅供复审</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function buildDoctorCertifications(fixture = [], doctorRows = []) {
  const sourceRows = Array.isArray(fixture) ? fixture : []
  const doctorMap = new Map(doctorRows.map((doctor) => [doctor.id, doctor]))
  const seenDoctorIds = new Set()
  const records = []

  sourceRows.forEach((source) => {
    const doctorId = Number(source.doctor_id)
    const status = String(source.status || '')
    if (
      !doctorMap.has(doctorId) ||
      seenDoctorIds.has(doctorId) ||
      !doctorCertificationStatuses.includes(status) ||
      status === 'unsubmitted'
    ) {
      return
    }

    const record = {
      ...source,
      id: Number(source.id),
      doctor_id: doctorId,
      status
    }
    records.push(record)
    seenDoctorIds.add(doctorId)
    doctorMap.get(doctorId).certification_status = status
  })

  let nextId =
    records.reduce((maxId, record) => Math.max(maxId, Number(record.id) || 0), 0) +
    1

  doctorRows.forEach((doctor) => {
    const status = doctor.certification_status
    if (status === 'unsubmitted' || seenDoctorIds.has(doctor.id)) return

    const reviewed = ['approved', 'rejected'].includes(status)
    records.push({
      id: nextId,
      doctor_id: doctor.id,
      certificate_type:
        doctorCertificateTypes[doctor.id % doctorCertificateTypes.length],
      status,
      submit_time: doctor.activation_time || doctor.create_time,
      review_time: reviewed
        ? doctor.last_login_time || doctor.activation_time || doctor.create_time
        : null,
      reviewer: reviewed ? '运营管理员' : '',
      reject_reason:
        status === 'rejected'
          ? '提交信息与执业资料不一致，请核对后重新提交'
          : ''
    })
    seenDoctorIds.add(doctor.id)
    nextId += 1
  })

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

function reviewQuestionPool(questionBank = []) {
  return questionBank
    .filter(
      (item) =>
        item.lifecycle_status === 'available' &&
        ['A', 'B', 'C'].includes(String(item.final_level).toUpperCase())
    )
    .sort(
      (left, right) =>
        String(left.drug_id).localeCompare(String(right.drug_id)) ||
        String(left.type_code).localeCompare(String(right.type_code)) ||
        Number(left.id) - Number(right.id)
    )
}

function taskItemSnapshot(question, task, sequence, id) {
  const completed = sequence <= Math.max(Number(task.completed_count) || 0, 0)

  return {
    id,
    task_id: task.id,
    sequence,
    question_id: question.id,
    question_no: question.question_no,
    drug_id: question.drug_id,
    drug_image_url: question.drug_image_url,
    drug_name: question.drug_name,
    drug_specification: question.drug_specification,
    drug_type: question.drug_type,
    drug_manufacturer: question.drug_manufacturer,
    disease_type: question.disease_type || '',
    department: question.department || '',
    type_code: question.type_code,
    type_name: question.type_name,
    question: question.question,
    answer: JSON.parse(JSON.stringify(question.answer)),
    source_reference: JSON.parse(JSON.stringify(question.source_reference)),
    risk_tags: [...question.risk_tags],
    risk_tag_names: resolveRiskTagNames(
      question.risk_tags,
      questionBankFixture.risk_tag_labels
    ),
    base_level: question.base_level,
    final_level: question.final_level,
    upgrade_reasons: [...question.upgrade_reasons],
    unit_reward_cent: question.unit_reward_cent,
    status: completed ? 'completed' : 'pending',
    reviewer_id: completed ? task.doctor_id : null,
    review_result: null,
    correction_content: null,
    reviewed_at: null,
    assigned_at: task.create_time
  }
}

function buildInitialTaskItems(taskRows = [], questionBank = []) {
  const questionPool = reviewQuestionPool(questionBank)
  const usedQuestionIdsByDoctor = new Map()
  const records = []

  if (questionPool.length === 0) {
    throw new Error('question bank must contain available A, B or C questions')
  }

  taskRows
    .slice()
    .sort((left, right) => left.id - right.id)
    .forEach((task) => {
      const itemCount = Math.max(Number(task.item_count) || 0, 0)
      const doctorKey = String(task.doctor_id)
      const usedQuestionIds =
        usedQuestionIdsByDoctor.get(doctorKey) || new Set()
      const selectedQuestions = []
      const questionOffset = ((Number(task.id) - 1) * 37) % questionPool.length

      for (
        let offset = 0;
        offset < questionPool.length && selectedQuestions.length < itemCount;
        offset += 1
      ) {
        const question = questionPool[(questionOffset + offset) % questionPool.length]
        const questionId = String(question.id)
        if (usedQuestionIds.has(questionId)) continue
        usedQuestionIds.add(questionId)
        selectedQuestions.push(question)
      }

      if (selectedQuestions.length !== itemCount) {
        throw new Error(`task ${task.task_no} cannot allocate enough unique questions`)
      }

      usedQuestionIdsByDoctor.set(doctorKey, usedQuestionIds)
      const levelSummary = { A: 0, B: 0, C: 0 }
      const totalRewardCent = selectedQuestions.reduce((total, question) => {
        levelSummary[question.final_level] += 1
        return total + Number(question.unit_reward_cent)
      }, 0)

      Object.assign(task, {
        target_points: totalRewardCent / 100,
        unit_reward_cent: null,
        total_reward_cent: totalRewardCent,
        level_summary: levelSummary,
        pricing_version: 'V5.0',
        pricing_model: 'question_level',
        allocation_rule: 'random_exact_value_no_fixed_ratio',
        settlement_cycle: 'monthly_next_month'
      })

      selectedQuestions.forEach((question, index) => {
        records.push(taskItemSnapshot(question, task, index + 1, records.length + 1))
      })
      recordQuestionAllocation(questionBank, selectedQuestions, task.doctor_id)
    })

  return records
}

function buildReviews(fixture = {}, snapshots = {}) {
  const initialTaskItems = Array.isArray(snapshots.taskItems)
    ? snapshots.taskItems
    : []
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
      const taskQuestions = initialTaskItems
        .filter((item) => item.task_id === task.id)
        .sort((left, right) => left.sequence - right.sequence)
        .slice(0, completedCount)

      if (taskQuestions.length !== completedCount) {
        throw new Error(`task ${task.task_no} does not have enough question items`)
      }

      for (let index = 0; index < completedCount; index += 1) {
        const questionSnapshot = taskQuestions[index]
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
          doctor_department: doctor?.department || task.department,
          drug_id: questionSnapshot.drug_id,
          drug_image_url: questionSnapshot.drug_image_url,
          drug_name: questionSnapshot.drug_name,
          drug_specification: questionSnapshot.drug_specification,
          drug_type: questionSnapshot.drug_type,
          drug_manufacturer: questionSnapshot.drug_manufacturer,
          disease_type: questionSnapshot.disease_type,
          question_department: questionSnapshot.department,
          question_id: questionSnapshot.question_id,
          question_no: questionSnapshot.question_no,
          type_code: questionSnapshot.type_code,
          type_name: questionSnapshot.type_name,
          base_level: questionSnapshot.base_level,
          final_level: questionSnapshot.final_level,
          upgrade_reasons: [...questionSnapshot.upgrade_reasons],
          risk_tags: [...questionSnapshot.risk_tags],
          risk_tag_names: [...questionSnapshot.risk_tag_names],
          unit_reward_cent: questionSnapshot.unit_reward_cent,
          question: questionSnapshot.question,
          answer: JSON.parse(JSON.stringify(questionSnapshot.answer)),
          source_reference: JSON.parse(
            JSON.stringify(questionSnapshot.source_reference)
          ),
          result: rejected ? 'rejected' : 'approved',
          issue_type: issueType,
          review_comment: commentPool[(task.id + index) % commentPool.length],
          review_time: reviewTime
        })
        questionSnapshot.review_result = rejected ? 'rejected' : 'approved'
        questionSnapshot.reviewed_at = reviewTime
        reviewId += 1
      }
    })

  return records
}

function syncInitialWithdrawalAmounts(records = [], initialTaskItems = []) {
  const consumedCountsByTask = new Map()

  records
    .slice()
    .sort(
      (left, right) =>
        String(left.apply_time).localeCompare(String(right.apply_time)) ||
        Number(left.id) - Number(right.id)
    )
    .forEach((withdrawal) => {
      const taskId = Number(withdrawal.source_task_id)
      const reviewCount = Math.max(Number(withdrawal.source_review_count) || 0, 0)
      const consumedCount = consumedCountsByTask.get(taskId) || 0
      const sourceItems = initialTaskItems
        .filter((item) => item.task_id === taskId && item.status === 'completed')
        .sort((left, right) => left.sequence - right.sequence)
        .slice(consumedCount, consumedCount + reviewCount)

      if (sourceItems.length !== reviewCount) {
        throw new Error(
          `withdrawal ${withdrawal.withdrawal_no} does not have enough completed task items`
        )
      }

      withdrawal.amount_cent = sourceItems.reduce(
        (total, item) => total + Number(item.unit_reward_cent),
        0
      )
      consumedCountsByTask.set(taskId, consumedCount + reviewCount)
    })
}

function summarizeWithdrawals(records = []) {
  return records.reduce(
    (summary, withdrawal) => {
      if (!getSettlementDoctorEligibility(withdrawal).eligible) return summary

      const amountCent = Number(withdrawal.amount_cent) || 0
      summary.total_count += 1
      summary.total_amount_cent += amountCent

      if (withdrawal.settlement_status === 'pending') {
        summary.pending_count += 1
        summary.pending_amount_cent += amountCent
      }

      if (withdrawal.settlement_status === 'exported') {
        summary.exported_count += 1
        summary.exported_amount_cent += amountCent
      }

      if (withdrawal.settlement_status === 'settled') {
        summary.settled_count += 1
        summary.settled_amount_cent += amountCent
      }

      return summary
    },
    {
      total_count: 0,
      total_amount_cent: 0,
      pending_count: 0,
      pending_amount_cent: 0,
      exported_count: 0,
      exported_amount_cent: 0,
      settled_count: 0,
      settled_amount_cent: 0
    }
  )
}

function resolveSettlementBatchStatus(records = []) {
  const statuses = new Set(records.map((item) => item.settlement_status))
  if (statuses.size === 1) return [...statuses][0]
  return 'partial'
}

function resolveSettlementDoctorStatus(records = [], eligible = false) {
  if (!eligible) return 'blocked'
  if (records.length === 0) return 'pending'
  if (records.every((item) => item.settlement_status === 'settled')) return 'settled'
  if (records.some((item) => item.settlement_status === 'exported')) return 'exported'
  return 'pending'
}

function getTaskBatchNo(task) {
  if (!task) return ''
  if (task.source_type === 'import' && task.import_batch_no) {
    return String(task.import_batch_no).trim()
  }
  return String(task.task_batch_no || task.task_no || '').trim()
}

function getTaskBatchDoctorKey(task) {
  return String(task?.doctor_id || task?.doctor_phone || task?.doctor_name || '')
}

function getWithdrawalTaskBatchNo(withdrawal) {
  const task = tasks.find((item) => item.id === withdrawal.source_task_id)
  return getTaskBatchNo(task) || withdrawal.source_task_no || withdrawal.task_batch_no || ''
}

function getSettlementDoctorEligibility(withdrawal) {
  const task = tasks.find((item) => item.id === withdrawal?.source_task_id)
  const batchNo = getWithdrawalTaskBatchNo(withdrawal)
  const doctorKey = getTaskBatchDoctorKey(task) || getTaskBatchDoctorKey(withdrawal)
  const doctorTasks = tasks.filter(
    (item) => getTaskBatchNo(item) === batchNo && getTaskBatchDoctorKey(item) === doctorKey
  )
  const assignedReviewCount = doctorTasks.reduce(
    (total, item) => total + Math.max(Number(item.item_count) || 0, 0),
    0
  )
  const completedReviewCount = doctorTasks.reduce(
    (total, item) =>
      total + Math.min(Math.max(Number(item.completed_count) || 0, 0), Math.max(Number(item.item_count) || 0, 0)),
    0
  )
  const duplicateTask = doctorTasks.length > 1

  return {
    eligible: doctorTasks.length === 1 && completedReviewCount >= assignedReviewCount,
    assigned_review_count: assignedReviewCount,
    completed_review_count: completedReviewCount,
    task: doctorTasks[0] || task || null,
    duplicate_task: duplicateTask
  }
}

function buildSettlementTaskRows(records = []) {
  const groups = new Map()

  records.forEach((withdrawal) => {
    const key = getTaskBatchDoctorKey(withdrawal)
    const task = tasks.find((item) => item.id === withdrawal.source_task_id)
    const doctor = doctors.find((item) => item.id === withdrawal.doctor_id)
    const eligibility = getSettlementDoctorEligibility(withdrawal)
    const row = groups.get(key) || {
      id: key,
      doctor_id: withdrawal.doctor_id,
      doctor_name: withdrawal.doctor_name,
      doctor_phone_masked: maskPhone(withdrawal.doctor_phone),
      hospital: doctor?.hospital || task?.hospital || null,
      department: doctor?.department || task?.department || null,
      assigned_review_count: eligibility.assigned_review_count,
      completed_review_count: eligibility.completed_review_count,
      settlement_eligible: eligibility.eligible,
      settlement_block_reason: eligibility.eligible
        ? ''
        : eligibility.duplicate_task
          ? '当前项目存在重复医生，暂不能结算'
          : `当前医生已完成 ${eligibility.completed_review_count} / ${eligibility.assigned_review_count} 条审核，审核未完成，不能结算`,
      review_completed_at: eligibility.eligible ? task?.complete_time || null : null,
      bank_name: withdrawal.bank_name,
      bank_card_masked: maskBankCard(withdrawal.bank_card_no),
      review_count: 0,
      amount_cent: 0,
      applied_at: withdrawal.apply_time,
      settlement_nos: [],
      records: []
    }

    row.review_count += Number(withdrawal.source_review_count) || 0
    row.amount_cent += Number(withdrawal.amount_cent) || 0
    row.settlement_nos.push(withdrawal.withdrawal_no)
    row.records.push(withdrawal)
    if (withdrawal.apply_time < row.applied_at) row.applied_at = withdrawal.apply_time
    groups.set(key, row)
  })

  return [...groups.values()]
    .map(({ records: taskRecords, ...row }) => ({
      ...row,
      status: resolveSettlementDoctorStatus(taskRecords, row.settlement_eligible),
      accrued_amount_cent: row.amount_cent,
      amount_cent: row.settlement_eligible ? row.amount_cent : 0
    }))
    .sort(
      (left, right) =>
        right.applied_at.localeCompare(left.applied_at) ||
        String(left.doctor_name).localeCompare(String(right.doctor_name), 'zh-CN')
    )
}

function buildSettlementBatches(records = []) {
  const groups = new Map()

  records.forEach((withdrawal) => {
    const batchNo = String(getWithdrawalTaskBatchNo(withdrawal)).trim()
    if (!batchNo) return
    const batchRows = groups.get(batchNo) || []
    batchRows.push(withdrawal)
    groups.set(batchNo, batchRows)
  })

  return [...groups.entries()].map(([batchNo, batchRows]) => {
    const dates = batchRows
      .map((item) => String(item.apply_time || '').slice(0, 10))
      .filter(Boolean)
      .sort()
    const exportedTimes = batchRows.map((item) => item.export_time).filter(Boolean).sort()
    const settledTimes = batchRows.map((item) => item.settled_time).filter(Boolean).sort()
    const taskSettlements = buildSettlementTaskRows(batchRows)
    const eligibleRows = batchRows.filter(
      (item) => getSettlementDoctorEligibility(item).eligible
    )
    const organizationRows = tasks
      .filter((task) => getTaskBatchNo(task) === batchNo)
      .map(hydrateTask)
      .map((task) => ({
        foundation_name: task.foundation_name || '',
        project_name: task.project_name || '',
        identifier_name: task.identifier_name || ''
      }))
      .filter(
        (organization) =>
          organization.foundation_name ||
          organization.project_name ||
          organization.identifier_name
      )
    const firstOrganization = organizationRows[0] || {}
    const organizationKey = (organization) =>
      [
        organization.foundation_name,
        organization.project_name,
        organization.identifier_name
      ].join('|')
    const hasMultipleOrganizations =
      new Set(organizationRows.map(organizationKey)).size > 1
    const firstDate = dates[0] || ''
    const lastDate = dates.at(-1) || ''

    return {
      id: batchNo,
      batch_no: batchNo,
      display_title: `项目 ${batchNo}`,
      foundation_name: hasMultipleOrganizations
        ? '多个基金会'
        : firstOrganization.foundation_name || '',
      project_name: hasMultipleOrganizations
        ? '多个项目'
        : firstOrganization.project_name || '',
      identifier_name: hasMultipleOrganizations
        ? '多个项目标识'
        : firstOrganization.identifier_name || '',
      status:
        taskSettlements.some((item) => item.status === 'blocked')
          ? taskSettlements.some((item) => item.status !== 'blocked')
            ? 'partial'
            : 'blocked'
          : resolveSettlementBatchStatus(batchRows),
      doctor_count: new Set(batchRows.map((item) => item.doctor_id)).size,
      eligible_doctor_count: taskSettlements.filter((item) => item.settlement_eligible).length,
      blocked_doctor_count: taskSettlements.filter((item) => !item.settlement_eligible).length,
      pending_doctor_count: taskSettlements.filter(
        (item) => item.status !== 'blocked' && item.status !== 'settled'
      ).length,
      pending_amount_cent: taskSettlements
        .filter((item) => item.status !== 'blocked' && item.status !== 'settled')
        .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
      assigned_review_count: taskSettlements.reduce(
        (total, item) => total + Number(item.assigned_review_count || 0),
        0
      ),
      completed_review_count: taskSettlements.reduce(
        (total, item) => total + Number(item.completed_review_count || 0),
        0
      ),
      review_count: batchRows.reduce(
        (total, item) => total + (Number(item.source_review_count) || 0),
        0
      ),
      total_amount_cent: eligibleRows.reduce(
        (total, item) => total + (Number(item.amount_cent) || 0),
        0
      ),
      period_start: firstDate || null,
      period_end: lastDate || null,
      created_at: batchRows.map((item) => item.apply_time).sort()[0] || null,
      exported_at:
        eligibleRows.map((item) => item.export_time).filter(Boolean).sort().at(-1) || null,
      settled_at:
        eligibleRows.length > 0 && eligibleRows.every((item) => item.settlement_status === 'settled')
          ? settledTimes.at(-1) || null
          : null,
      task_settlements: taskSettlements
    }
  })
}

function summarizeSettlementBatches(records = []) {
  return buildSettlementBatches(records).reduce(
    (summary, batch) => {
      summary.total_batch_count += 1
      summary.total_amount_cent += batch.total_amount_cent
      if (batch.status === 'pending') summary.pending_batch_count += 1
      if (batch.status === 'exported' || batch.status === 'partial') {
        summary.processing_batch_count += 1
      }
      if (batch.status === 'settled') summary.settled_batch_count += 1
      return summary
    },
    {
      total_batch_count: 0,
      pending_batch_count: 0,
      processing_batch_count: 0,
      settled_batch_count: 0,
      total_amount_cent: 0
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
  workbenchFixture.settlement.settled_amount_cent =
    withdrawalSummary.settled_amount_cent

  if (withdrawalSummary.pending_count === 0) {
    if (todoIndex >= 0) workbenchFixture.todos.splice(todoIndex, 1)
    return
  }

  const withdrawalTodo = {
    id: 'withdrawal_pending',
    title: '项目待结算',
    description: `${withdrawalSummary.pending_count} 条审核结算记录待导出并提交基金会。`,
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

function syncCertificationWorkbench() {
  const pendingCount = doctorCertifications.filter(
    (certification) => certification.status === 'pending'
  ).length
  const todoIndex = workbenchFixture.todos.findIndex(
    (todo) => todo.id === 'certification_pending'
  )

  if (pendingCount === 0) {
    if (todoIndex >= 0) workbenchFixture.todos.splice(todoIndex, 1)
    return
  }

  const certTodo = {
    id: 'certification_pending',
    title: '医生认证待复审',
    description: `${pendingCount} 位医生已提交执业认证资料，等待人工复审。`,
    count: pendingCount,
    level: 'info'
  }

  if (todoIndex >= 0) {
    workbenchFixture.todos[todoIndex] = {
      ...workbenchFixture.todos[todoIndex],
      ...certTodo
    }
    return
  }

  workbenchFixture.todos.push(certTodo)
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
    status: withdrawal.settlement_status,
    applied_at: withdrawal.apply_time,
    exported_at: withdrawal.export_time,
    settled_at: withdrawal.settled_time || null,
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

function normalizeSettlementMonth(value) {
  const month = String(value || '').trim()
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : ''
}

function settlementMonthLabel(month) {
  const [year, value] = String(month || '').split('-')
  return year && value ? `${year} 年 ${Number(value)} 月` : '—'
}

function nextSettlementMonth(month) {
  const normalized = normalizeSettlementMonth(month)
  if (!normalized) return ''
  const [year, value] = normalized.split('-').map(Number)
  const date = new Date(year, value, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function settlementCycleGeneratedAt(month) {
  const nextMonth = nextSettlementMonth(month)
  return nextMonth ? `${nextMonth}-01 00:00:00` : formatDateTime()
}

function latestLedgerMonth() {
  return pointLedger
    .map((item) => item.source_month)
    .filter(Boolean)
    .sort()
    .at(-1) || ''
}

function buildDoctorPaymentAccounts(doctorRows = [], withdrawalRows = []) {
  const latestByDoctor = new Map()

  withdrawalRows
    .slice()
    .sort((left, right) =>
      String(left.apply_time || '').localeCompare(String(right.apply_time || ''))
    )
    .forEach((withdrawal) => {
      if (!Number(withdrawal.doctor_id)) return
      latestByDoctor.set(Number(withdrawal.doctor_id), withdrawal)
    })

  return doctorRows
    .map((doctor) => {
      const source = latestByDoctor.get(doctor.id)
      if (!source) return null
      return {
        id: doctor.id,
        doctor_id: doctor.id,
        payee_name: source.doctor_name || doctor.name,
        id_card_no: source.id_card_no || '',
        bank_name: source.bank_name || '',
        bank_card_no: source.bank_card_no || '',
        status: 'complete',
        source: 'legacy',
        confirmed_by: '历史数据迁移',
        confirmed_at: source.apply_time || null,
        update_time: source.apply_time || doctor.create_time
      }
    })
    .filter(Boolean)
}

function getDoctorPaymentAccount(doctorId) {
  return doctorPaymentAccounts.find(
    (item) => item.doctor_id === Number(doctorId)
  ) || null
}

function isPaymentAccountComplete(account) {
  return Boolean(
    account &&
      account.status === 'complete' &&
      account.payee_name &&
      /^\d{17}[\dXx]$/.test(account.id_card_no) &&
      account.bank_name &&
      /^\d{16,19}$/.test(account.bank_card_no)
  )
}

function toPublicPaymentAccount(account, includeSensitive = false) {
  if (!account) {
    return {
      status: 'missing',
      payee_name: '',
      id_card_masked: '',
      bank_name: '',
      bank_card_masked: '',
      source: '',
      update_time: null
    }
  }

  return {
    id: account.id,
    doctor_id: account.doctor_id,
    status: isPaymentAccountComplete(account) ? 'complete' : 'incomplete',
    payee_name: account.payee_name,
    id_card_masked: maskIdCard(account.id_card_no),
    bank_name: account.bank_name,
    bank_card_masked: maskBankCard(account.bank_card_no),
    source: account.source,
    confirmed_by: account.confirmed_by,
    confirmed_at: account.confirmed_at,
    update_time: account.update_time,
    ...(includeSensitive
      ? {
          id_card_no: account.id_card_no,
          bank_card_no: account.bank_card_no
        }
      : {})
  }
}

function buildPointLedger(reviewRows = []) {
  return reviewRows
    .map((review) => {
      const task = tasks.find((item) => item.id === review.task_id)
      const hydratedTask = task ? hydrateTask(task) : null
      return {
        id: review.id,
        review_id: review.id,
        review_no: review.review_no,
        doctor_id: review.doctor_id,
        task_id: review.task_id,
        task_no: review.task_no,
        foundation_name: hydratedTask?.foundation_name || '',
        project_name: hydratedTask?.project_name || '',
        identifier_name: hydratedTask?.identifier_name || '',
        final_level: review.final_level,
        amount_cent: Number(review.unit_reward_cent) || 0,
        earned_at: review.review_time,
        source_month: String(review.review_time || '').slice(0, 7),
        status: 'unsettled',
        settlement_order_id: null,
        settled_at: null
      }
    })
    .filter((item) => item.amount_cent !== 0 && item.source_month)
    .sort(
      (left, right) =>
        String(left.earned_at).localeCompare(String(right.earned_at)) ||
        left.id - right.id
    )
}

function getMonthlySettlementEligibility(doctorId) {
  const doctor = doctors.find((item) => item.id === Number(doctorId))
  const paymentAccount = getDoctorPaymentAccount(doctorId)
  const certificationComplete = doctor?.certification_status === 'approved'
  const paymentComplete = isPaymentAccountComplete(paymentAccount)
  let status = 'eligible'
  let reason = ''

  if (!certificationComplete && !paymentComplete) {
    status = 'deferred_both'
    reason = '专业认证未通过且收款信息未填写，积分将继续累计'
  } else if (!certificationComplete) {
    status = 'deferred_certification'
    reason = '专业认证未通过，积分将继续累计'
  } else if (!paymentComplete) {
    status = 'deferred_payment'
    reason = '收款信息未填写完整，积分将继续累计'
  }

  return {
    eligible: certificationComplete && paymentComplete,
    status,
    reason,
    certification_complete: certificationComplete,
    certification_status: doctor?.certification_status || 'unsubmitted',
    payment_complete: paymentComplete,
    payment_account_status: paymentComplete
      ? 'complete'
      : paymentAccount
        ? 'incomplete'
        : 'missing'
  }
}

function ensureMonthlySettlementCycle(month, generatedAt = null) {
  const normalized = normalizeSettlementMonth(month)
  if (!normalized) return null
  const existing = monthlySettlementCycles.find(
    (item) => item.settlement_month === normalized
  )
  if (existing) return existing

  const cycle = {
    id: nextMonthlySettlementCycleId,
    cycle_no: `YJ${normalized.replace('-', '')}`,
    settlement_month: normalized,
    period_start: `${normalized}-01 00:00:00`,
    period_end: `${normalized}-${new Date(
      Number(normalized.slice(0, 4)),
      Number(normalized.slice(5, 7)),
      0
    ).getDate()} 23:59:59`,
    generated_at: generatedAt || settlementCycleGeneratedAt(normalized),
    auto_run_completed: false,
    deferred_doctors: []
  }
  nextMonthlySettlementCycleId += 1
  monthlySettlementCycles.push(cycle)
  return cycle
}

function ledgerRowsForOrder(orderId) {
  return pointLedger.filter(
    (item) => item.settlement_order_id === Number(orderId)
  )
}

function createMonthlySettlementOrder({
  cycle,
  doctorId,
  ledgerRows,
  settlementType = 'auto',
  generatedAt = formatDateTime(),
  cutoffAt = null,
  manualReason = '',
  settlementNo = '',
  initialStatus = 'pending_export',
  exportedAt = null,
  paidAt = null,
  paymentSnapshot = null
}) {
  const availableRows = ledgerRows.filter(
    (item) => item.status === 'unsettled' && !item.settlement_order_id
  )
  const amountCent = availableRows.reduce(
    (total, item) => total + Number(item.amount_cent || 0),
    0
  )

  // A doctor with zero settleable points must never receive a settlement record.
  if (availableRows.length === 0 || amountCent <= 0) return null

  const doctor = doctors.find((item) => item.id === Number(doctorId))
  if (!doctor) return null
  const calculationMonth =
    settlementType === 'manual'
      ? String(cutoffAt || generatedAt).slice(0, 7)
      : cycle.settlement_month
  const settlementMonth = cycle?.settlement_month || calculationMonth
  const currentMonthAmountCent = availableRows
    .filter((item) => item.source_month === calculationMonth)
    .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
  const orderId = nextMonthlySettlementOrderId
  const order = {
    id: orderId,
    settlement_no:
      settlementNo ||
      (settlementType === 'manual'
        ? `RGJS${String(generatedAt).slice(0, 10).replaceAll('-', '')}${String(orderId).padStart(5, '0')}`
        : `JS${settlementMonth.replace('-', '')}${String(orderId).padStart(5, '0')}`),
    cycle_id: cycle?.id || null,
    doctor_id: doctor.id,
    settlement_type: settlementType,
    calculation_month: calculationMonth,
    cutoff_at: cutoffAt || cycle?.period_end || generatedAt,
    generated_at: generatedAt,
    certification_status: doctor.certification_status,
    manual_reason: manualReason,
    amount_cent: amountCent,
    current_month_amount_cent: currentMonthAmountCent,
    carryover_amount_cent: amountCent - currentMonthAmountCent,
    review_count: availableRows.length,
    source_months: [...new Set(availableRows.map((item) => item.source_month))].sort(),
    status: initialStatus,
    exported_at: exportedAt,
    paid_at: paidAt,
    transaction_no: '',
    payment_failed_reason: '',
    payment_snapshot:
      paymentSnapshot ||
      toPublicPaymentAccount(getDoctorPaymentAccount(doctor.id), true),
    export_id: null
  }
  nextMonthlySettlementOrderId += 1
  monthlySettlementOrders.push(order)

  availableRows.forEach((item) => {
    item.status = initialStatus === 'paid' ? 'settled' : 'locked'
    item.settlement_order_id = order.id
    item.settled_at = initialStatus === 'paid' ? paidAt || generatedAt : null
  })

  monthlySettlementAuditLogs.push({
    id: monthlySettlementAuditLogs.length + 1,
    action: settlementType === 'manual' ? 'manual_created' : 'order_created',
    order_id: order.id,
    operator: settlementType === 'manual' ? '运营管理员' : '系统月结任务',
    remark: manualReason,
    create_time: generatedAt
  })
  return order
}

function initializeMonthlySettlementState() {
  const initialMonth = latestLedgerMonth()
  if (initialMonth) {
    const executedAt = settlementCycleGeneratedAt(initialMonth)
    const result = runMonthlySettlementCycle(initialMonth, executedAt)
    recordMonthlySettlementJob({
      month: initialMonth,
      executedAt,
      triggerType: 'automatic',
      result
    })
  }
}

function runMonthlySettlementCycle(month, generatedAt = formatDateTime()) {
  const normalized = normalizeSettlementMonth(month)
  if (!normalized) return { error: '月结账期格式必须为 YYYY-MM' }
  const existing = monthlySettlementCycles.find(
    (item) => item.settlement_month === normalized
  )
  if (existing?.auto_run_completed) return { cycle: existing, created_count: 0 }

  const periodEnd = `${normalized}-${new Date(
    Number(normalized.slice(0, 4)),
    Number(normalized.slice(5, 7)),
    0
  ).getDate()} 23:59:59`
  const candidates = pointLedger.filter(
    (item) =>
      item.status === 'unsettled' &&
      !item.settlement_order_id &&
      item.earned_at <= periodEnd
  )
  const doctorGroups = new Map()
  candidates.forEach((item) => {
    const rows = doctorGroups.get(item.doctor_id) || []
    rows.push(item)
    doctorGroups.set(item.doctor_id, rows)
  })

  const positiveGroups = [...doctorGroups.entries()].filter(([, rows]) =>
    rows.reduce((total, item) => total + Number(item.amount_cent || 0), 0) > 0
  )
  if (positiveGroups.length === 0 && !existing) {
    return { cycle: null, created_count: 0, no_settleable_points: true }
  }

  const cycle = existing || ensureMonthlySettlementCycle(normalized, generatedAt)
  cycle.deferred_doctors = []
  let createdCount = 0

  positiveGroups.forEach(([doctorId, rows]) => {
    const doctor = doctors.find((item) => item.id === Number(doctorId))
    if (!doctor) return
    const eligibility = getMonthlySettlementEligibility(doctorId)
    const amountCent = rows.reduce(
      (total, item) => total + Number(item.amount_cent || 0),
      0
    )
    if (amountCent <= 0) return

    if (eligibility.eligible) {
      const order = createMonthlySettlementOrder({
        cycle,
        doctorId,
        ledgerRows: rows,
        generatedAt,
        cutoffAt: periodEnd
      })
      if (order) {
        createdCount += 1
      }
      return
    }

    cycle.deferred_doctors.push({
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      doctor_phone_masked: maskPhone(doctor.phone),
      hospital: doctor.hospital,
      department: doctor.department,
      accrued_amount_cent: amountCent,
      review_count: rows.length,
      source_months: [...new Set(rows.map((item) => item.source_month))].sort(),
      ...eligibility
    })
  })

  cycle.auto_run_completed = true
  return { cycle, created_count: createdCount }
}

function recordMonthlySettlementJob({
  month,
  executedAt = formatDateTime(),
  triggerType = 'manual',
  result
}) {
  const normalized = normalizeSettlementMonth(month)
  const cycle = result?.cycle || null
  const noSettleablePoints = result?.no_settleable_points === true
  const createdCount = Number(result?.created_count || 0)
  const deferredCount = Number(cycle?.deferred_doctors?.length || 0)
  const log = {
    id: nextMonthlySettlementJobLogId,
    job_no: `YJJOB${String(nextMonthlySettlementJobLogId).padStart(6, '0')}`,
    settlement_month: normalized,
    trigger_type: triggerType,
    status: result?.error ? 'failed' : 'success',
    cycle_id: cycle?.id || null,
    cycle_no: cycle?.cycle_no || '',
    created_order_count: createdCount,
    deferred_doctor_count: deferredCount,
    no_settleable_points: noSettleablePoints,
    result_message: result?.error
      ? result.error
      : noSettleablePoints
        ? '当前账期没有可结算积分，未生成月结记录'
        : createdCount > 0
          ? `本次纳入 ${createdCount} 位医生`
          : '月结任务已执行，无需重复生成',
    executed_at: executedAt
  }
  nextMonthlySettlementJobLogId += 1
  monthlySettlementJobLogs.unshift(log)
  return log
}

function toPublicMonthlySettlementOrder(order, includeLines = false) {
  const doctor = doctors.find((item) => item.id === order.doctor_id)
  const rows = ledgerRowsForOrder(order.id)
  const { payment_snapshot: paymentSnapshot, ...publicOrder } = order
  const projectCount = new Set(
    rows.map((item) =>
      [item.foundation_name, item.project_name, item.identifier_name].join('|')
    )
  ).size
  const result = {
    ...publicOrder,
    doctor_name: doctor?.name || '—',
    doctor_phone_masked: maskPhone(doctor?.phone),
    hospital: doctor?.hospital || '',
    department: doctor?.department || '',
    project_count: projectCount,
    payment_account: paymentSnapshot
      ? {
          status: paymentSnapshot.status || 'complete',
          payee_name: paymentSnapshot.payee_name,
          id_card_masked:
            paymentSnapshot.id_card_masked ||
            maskIdCard(paymentSnapshot.id_card_no),
          bank_name: paymentSnapshot.bank_name,
          bank_card_masked:
            paymentSnapshot.bank_card_masked ||
            maskBankCard(paymentSnapshot.bank_card_no)
        }
      : toPublicPaymentAccount(getDoctorPaymentAccount(order.doctor_id))
  }

  if (includeLines) {
    result.lines = rows.map((item) => {
      const review = reviews.find((row) => row.id === item.review_id)
      return {
        ...item,
        drug_name: review?.drug_name || '',
        drug_specification: review?.drug_specification || '',
        type_name: review?.type_name || '',
        question: review?.question || '',
        answer: review?.answer || '',
        review_result: review?.result || '',
        issue_type: review?.issue_type || '',
        review_comment: review?.review_comment || ''
      }
    })
    result.audit_logs = monthlySettlementAuditLogs.filter(
      (item) => item.order_id === order.id
    )
  }
  return result
}

function resolveMonthlySettlementCycleStatus(orders = [], deferredDoctors = []) {
  if (deferredDoctors.length > 0) return 'partial'
  if (orders.length === 0) return 'pending_export'
  if (orders.every((item) => item.status === 'paid')) return 'settled'
  if (orders.every((item) => item.status === 'pending_export')) return 'pending_export'
  if (orders.every((item) => item.status === 'exported')) return 'exported'
  return 'partial'
}

function toPublicMonthlySettlementCycle(cycle, includeDoctors = false) {
  const orders = monthlySettlementOrders.filter((item) => item.cycle_id === cycle.id)
  const deferredDoctors = cycle.deferred_doctors || []
  const result = {
    id: cycle.id,
    batch_no: cycle.cycle_no,
    cycle_no: cycle.cycle_no,
    settlement_month: cycle.settlement_month,
    display_title: `${settlementMonthLabel(cycle.settlement_month)}月结`,
    period_start: cycle.period_start,
    period_end: cycle.period_end,
    generated_at: cycle.generated_at,
    status: resolveMonthlySettlementCycleStatus(orders, deferredDoctors),
    doctor_count: new Set([
      ...orders.map((item) => item.doctor_id),
      ...deferredDoctors.map((item) => item.doctor_id)
    ]).size,
    order_count: orders.length,
    pending_export_count: orders.filter((item) => item.status === 'pending_export').length,
    exported_count: orders.filter((item) => item.status === 'exported').length,
    payment_failed_count: orders.filter((item) => item.status === 'payment_failed').length,
    paid_count: orders.filter((item) => item.status === 'paid').length,
    deferred_doctor_count: deferredDoctors.length,
    deferred_amount_cent: deferredDoctors.reduce(
      (total, item) => total + Number(item.accrued_amount_cent || 0),
      0
    ),
    pending_export_amount_cent: orders
      .filter((item) => item.status === 'pending_export')
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
    processing_amount_cent: orders
      .filter((item) => ['exported', 'payment_failed'].includes(item.status))
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
    paid_amount_cent: orders
      .filter((item) => item.status === 'paid')
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
    total_amount_cent: orders.reduce(
      (total, item) => total + Number(item.amount_cent || 0),
      0
    )
  }
  if (includeDoctors) {
    result.doctor_settlements = orders.map((item) =>
      toPublicMonthlySettlementOrder(item)
    )
    const cutoffAt = formatDateTime()
    result.deferred_doctors = deferredDoctors.map((item) => {
      const currentSettleableAmountCent = pointLedger
        .filter(
          (row) =>
            row.doctor_id === item.doctor_id &&
            row.status === 'unsettled' &&
            !row.settlement_order_id &&
            row.earned_at <= cutoffAt
        )
        .reduce((total, row) => total + Number(row.amount_cent || 0), 0)
      const currentEligibility = getMonthlySettlementEligibility(item.doctor_id)
      return {
        ...item,
        current_settleable_amount_cent: currentSettleableAmountCent,
        current_payment_complete: currentEligibility.payment_complete,
        current_payment_account_status: currentEligibility.payment_account_status
      }
    })
  }
  return result
}

function buildMonthlySettlementHistoryRows() {
  const months = new Set([
    ...monthlySettlementCycles.map((item) => item.settlement_month),
    ...monthlySettlementJobLogs.map((item) => item.settlement_month)
  ])

  return [...months]
    .filter(Boolean)
    .map((month) => {
      const cycle = monthlySettlementCycles.find(
        (item) => item.settlement_month === month
      )
      const jobs = monthlySettlementJobLogs
        .filter((item) => item.settlement_month === month)
        .sort((left, right) =>
          String(right.executed_at).localeCompare(String(left.executed_at))
        )
      const latestJob = jobs[0] || null
      const cycleData = cycle
        ? toPublicMonthlySettlementCycle(cycle)
        : {
            id: `history-${month}`,
            batch_no: '',
            cycle_no: '',
            settlement_month: month,
            display_title: `${settlementMonthLabel(month)}月结`,
            period_start: `${month}-01 00:00:00`,
            period_end: `${month}-${new Date(
              Number(month.slice(0, 4)),
              Number(month.slice(5, 7)),
              0
            ).getDate()} 23:59:59`,
            generated_at: null,
            status: 'not_generated',
            doctor_count: 0,
            order_count: 0,
            pending_export_count: 0,
            exported_count: 0,
            payment_failed_count: 0,
            paid_count: 0,
            deferred_doctor_count: 0,
            deferred_amount_cent: 0,
            pending_export_amount_cent: 0,
            processing_amount_cent: 0,
            paid_amount_cent: 0,
            total_amount_cent: 0
          }
      return {
        ...cycleData,
        cycle_id: cycle?.id || null,
        has_cycle: Boolean(cycle),
        execution_count: jobs.length,
        job_no: latestJob?.job_no || '',
        trigger_type: latestJob?.trigger_type || '',
        job_status: latestJob?.status || '',
        created_order_count: Number(latestJob?.created_order_count || 0),
        job_deferred_doctor_count: Number(
          latestJob?.deferred_doctor_count || 0
        ),
        no_settleable_points: latestJob?.no_settleable_points === true,
        result_message: latestJob?.result_message || '暂无任务执行记录',
        executed_at: latestJob?.executed_at || cycle?.generated_at || null
      }
    })
    .sort((left, right) =>
      String(right.settlement_month).localeCompare(String(left.settlement_month))
    )
}

function buildSettlementHistoryRows() {
  const monthlyRows = buildMonthlySettlementHistoryRows().map((item) => ({
    ...item,
    id: item.cycle_id ? `cycle-${item.cycle_id}` : item.id,
    record_id: item.cycle_id,
    record_type: 'monthly_cycle',
    record_no: item.cycle_no || item.job_no,
    status_dict: 'monthly_settlement_cycle_status',
    doctor_name: '',
    doctor_phone_masked: '',
    review_count: 0,
    manual_reason: ''
  }))
  const manualRows = monthlySettlementOrders
    .filter(
      (item) => item.settlement_type === 'manual' && item.cycle_id === null
    )
    .map((order) => {
      const publicOrder = toPublicMonthlySettlementOrder(order)
      const isPending = order.status === 'pending_export'
      const isProcessing = ['exported', 'payment_failed'].includes(order.status)
      const isPaid = order.status === 'paid'
      return {
        id: `manual-${order.id}`,
        record_id: order.id,
        record_type: 'manual_settlement',
        record_no: order.settlement_no,
        cycle_id: null,
        has_cycle: false,
        settlement_month: order.calculation_month,
        display_title: `${publicOrder.doctor_name}·人工结算`,
        period_start: null,
        period_end: order.cutoff_at,
        generated_at: order.generated_at,
        executed_at: order.generated_at,
        status: order.status,
        status_dict: 'monthly_settlement_order_status',
        doctor_count: 1,
        order_count: 1,
        doctor_name: publicOrder.doctor_name,
        doctor_phone_masked: publicOrder.doctor_phone_masked,
        review_count: order.review_count,
        pending_export_count: isPending ? 1 : 0,
        exported_count: order.status === 'exported' ? 1 : 0,
        payment_failed_count: order.status === 'payment_failed' ? 1 : 0,
        paid_count: isPaid ? 1 : 0,
        deferred_doctor_count: 0,
        pending_export_amount_cent: isPending ? order.amount_cent : 0,
        deferred_amount_cent: 0,
        processing_amount_cent: isProcessing ? order.amount_cent : 0,
        paid_amount_cent: isPaid ? order.amount_cent : 0,
        total_amount_cent: order.amount_cent,
        execution_count: 0,
        job_no: '',
        trigger_type: 'manual_settlement',
        job_status: '',
        created_order_count: 1,
        job_deferred_doctor_count: 0,
        no_settleable_points: false,
        result_message: '工作人员人工单独结算，不计入月结账期',
        manual_reason: order.manual_reason || '',
        payment_account: publicOrder.payment_account
      }
    })

  return [...monthlyRows, ...manualRows].sort(
    (left, right) =>
      String(right.settlement_month).localeCompare(String(left.settlement_month)) ||
      String(right.executed_at || '').localeCompare(String(left.executed_at || '')) ||
      (left.record_type === 'monthly_cycle' ? -1 : 1)
  )
}

function currentDeferredSettlementRows() {
  const currentMonth = formatDateTime().slice(0, 7)
  const groups = new Map()
  pointLedger
    .filter(
      (item) =>
        item.status === 'unsettled' &&
        !item.settlement_order_id &&
        item.source_month < currentMonth
    )
    .forEach((item) => {
      const rows = groups.get(item.doctor_id) || []
      rows.push(item)
      groups.set(item.doctor_id, rows)
    })
  return [...groups.entries()]
    .map(([doctorId, rows]) => ({
      doctor_id: doctorId,
      amount_cent: rows.reduce(
        (total, item) => total + Number(item.amount_cent || 0),
        0
      ),
      eligibility: getMonthlySettlementEligibility(doctorId)
    }))
    .filter((item) => item.amount_cent > 0)
}

function buildMonthlySettlementSummary() {
  const currentMonth = formatDateTime().slice(0, 7)
  const orders = monthlySettlementOrders.filter((item) => item.cycle_id !== null)
  const deferredRows = currentDeferredSettlementRows()
  return {
    total_cycle_count: monthlySettlementCycles.length,
    current_month_accrued_amount_cent: pointLedger
      .filter((item) => item.source_month === currentMonth)
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
    pending_export_count: orders.filter((item) => item.status === 'pending_export').length,
    pending_export_amount_cent: orders
      .filter((item) => item.status === 'pending_export')
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
    deferred_doctor_count: deferredRows.length,
    deferred_amount_cent: deferredRows.reduce(
      (total, item) => total + item.amount_cent,
      0
    ),
    processing_count: orders.filter((item) =>
      ['exported', 'payment_failed'].includes(item.status)
    ).length,
    processing_amount_cent: orders
      .filter((item) => ['exported', 'payment_failed'].includes(item.status))
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0),
    paid_count: orders.filter((item) => item.status === 'paid').length,
    paid_amount_cent: orders
      .filter((item) => item.status === 'paid')
      .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
  }
}

function syncMonthlySettlementWorkbench() {
  const summary = buildMonthlySettlementSummary()
  const totalAccruedCent = pointLedger.reduce(
    (total, item) => total + Number(item.amount_cent || 0),
    0
  )
  workbenchFixture.settlement.accrued_amount_cent = totalAccruedCent
  workbenchFixture.settlement.withdrawable_amount_cent =
    summary.pending_export_amount_cent
  workbenchFixture.settlement.pending_withdrawal_amount_cent =
    summary.pending_export_amount_cent
  workbenchFixture.settlement.pending_export_amount_cent =
    summary.pending_export_amount_cent
  workbenchFixture.settlement.exported_amount_cent =
    summary.processing_amount_cent
  workbenchFixture.settlement.settled_amount_cent = summary.paid_amount_cent
  workbenchFixture.updated_at = formatDateTime()

  const todoIndex = workbenchFixture.todos.findIndex(
    (todo) => todo.id === 'withdrawal_pending'
  )
  const pendingCount =
    summary.pending_export_count + summary.deferred_doctor_count
  if (pendingCount === 0) {
    if (todoIndex >= 0) workbenchFixture.todos.splice(todoIndex, 1)
    return
  }
  const todo = {
    id: 'withdrawal_pending',
    title: '月结事项待处理',
    description: `${summary.pending_export_count} 位医生待导出，${summary.deferred_doctor_count} 位医生因条件未完成而延期。`,
    count: pendingCount,
    level: summary.deferred_doctor_count > 0 ? 'warning' : 'info'
  }
  if (todoIndex >= 0) workbenchFixture.todos[todoIndex] = todo
  else workbenchFixture.todos.push(todo)
}

function createManualMonthlySettlement({ doctorId, reason, operator }) {
  const doctor = doctors.find((item) => item.id === Number(doctorId))
  if (!doctor) return { error: '未找到对应医生' }
  const paymentAccount = getDoctorPaymentAccount(doctor.id)
  if (!isPaymentAccountComplete(paymentAccount)) {
    return { error: '请先补齐并确认该医生的收款信息' }
  }
  if (!String(reason || '').trim()) return { error: '请填写人工单独结算原因' }
  if (String(reason).trim().length > 200) {
    return { error: '人工单独结算原因不能超过 200 个字符' }
  }

  const cutoffAt = formatDateTime()
  const rows = pointLedger.filter(
    (item) =>
      item.doctor_id === doctor.id &&
      item.status === 'unsettled' &&
      !item.settlement_order_id &&
      item.earned_at <= cutoffAt
  )
  const amountCent = rows.reduce(
    (total, item) => total + Number(item.amount_cent || 0),
    0
  )
  if (amountCent <= 0) {
    return { error: '该医生当前没有可结算积分，未生成结算记录' }
  }

  const order = createMonthlySettlementOrder({
    cycle: null,
    doctorId: doctor.id,
    ledgerRows: rows,
    settlementType: 'manual',
    generatedAt: cutoffAt,
    cutoffAt,
    manualReason: String(reason).trim()
  })
  if (!order) return { error: '该医生当前没有可结算积分，未生成结算记录' }
  monthlySettlementAuditLogs.push({
    id: monthlySettlementAuditLogs.length + 1,
    action: 'manual_approved',
    order_id: order.id,
    operator: operator || '运营管理员',
    remark: String(reason).trim(),
    create_time: cutoffAt
  })
  syncMonthlySettlementWorkbench()
  return { order }
}

function buildManualSettlementCandidates(keyword = '') {
  const cutoffAt = formatDateTime()
  const currentMonth = cutoffAt.slice(0, 7)
  const doctorGroups = new Map()

  pointLedger
    .filter(
      (item) =>
        item.status === 'unsettled' &&
        !item.settlement_order_id &&
        item.earned_at <= cutoffAt
    )
    .forEach((item) => {
      const rows = doctorGroups.get(item.doctor_id) || []
      rows.push(item)
      doctorGroups.set(item.doctor_id, rows)
    })

  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return [...doctorGroups.entries()]
    .map(([doctorId, rows]) => {
      const doctor = doctors.find((item) => item.id === Number(doctorId))
      if (!doctor) return null
      const amountCent = rows.reduce(
        (total, item) => total + Number(item.amount_cent || 0),
        0
      )
      if (amountCent <= 0) return null
      const currentMonthAmountCent = rows
        .filter((item) => item.source_month === currentMonth)
        .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
      const eligibility = getMonthlySettlementEligibility(doctor.id)
      return {
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        doctor_phone_masked: maskPhone(doctor.phone),
        hospital: doctor.hospital,
        department: doctor.department,
        amount_cent: amountCent,
        current_month_amount_cent: currentMonthAmountCent,
        carryover_amount_cent: amountCent - currentMonthAmountCent,
        review_count: rows.length,
        source_months: [...new Set(rows.map((item) => item.source_month))].sort(),
        ...eligibility,
        payment_account: toPublicPaymentAccount(
          getDoctorPaymentAccount(doctor.id)
        )
      }
    })
    .filter(Boolean)
    .filter((item) => {
      if (!normalizedKeyword) return true
      return [
        item.doctor_name,
        item.doctor_phone_masked,
        item.hospital,
        item.department
      ].some((value) =>
        String(value || '').toLowerCase().includes(normalizedKeyword)
      )
    })
    .sort(
      (left, right) =>
        right.amount_cent - left.amount_cent ||
        String(left.doctor_name).localeCompare(String(right.doctor_name), 'zh-CN')
    )
}

function buildDoctorSettlementOverview(doctorId) {
  const doctor = doctors.find((item) => item.id === Number(doctorId))
  if (!doctor) return null
  const currentMonth = formatDateTime().slice(0, 7)
  const unsettledRows = pointLedger.filter(
    (item) =>
      item.doctor_id === doctor.id &&
      item.status === 'unsettled' &&
      !item.settlement_order_id
  )
  const currentMonthAmountCent = unsettledRows
    .filter((item) => item.source_month === currentMonth)
    .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
  const carryoverAmountCent = unsettledRows
    .filter((item) => item.source_month < currentMonth)
    .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
  const eligibility = getMonthlySettlementEligibility(doctor.id)
  return {
    doctor_id: doctor.id,
    current_month: currentMonth,
    current_month_amount_cent: currentMonthAmountCent,
    carryover_amount_cent: carryoverAmountCent,
    estimated_next_settlement_amount_cent:
      currentMonthAmountCent + carryoverAmountCent,
    eligibility,
    payment_account: toPublicPaymentAccount(getDoctorPaymentAccount(doctor.id)),
    next_cycle_at: settlementCycleGeneratedAt(currentMonth),
    settlement_records: monthlySettlementOrders
      .filter((item) => item.doctor_id === doctor.id)
      .sort((left, right) =>
        String(right.generated_at).localeCompare(String(left.generated_at))
      )
      .map((item) => toPublicMonthlySettlementOrder(item))
  }
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

function styleSettlementWorksheet(worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount }
  }
  const header = worksheet.getRow(1)
  header.height = 26
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F80ED' }
  }
  header.alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.alignment = { vertical: 'top', wrapText: true }
  })
}

function fullPaymentSnapshotForOrder(order) {
  const account = getDoctorPaymentAccount(order.doctor_id)
  if (!isPaymentAccountComplete(account)) return null
  return toPublicPaymentAccount(account, true)
}

async function buildMonthlySettlementExportFiles(orders = [], exportNo = '') {
  const isManualExport =
    orders.length > 0 && orders.every((item) => item.settlement_type === 'manual')
  const preparedOrders = orders.map((order) => ({
    order,
    paymentSnapshot: fullPaymentSnapshotForOrder(order)
  }))
  const missingAccount = preparedOrders.find((item) => !item.paymentSnapshot)
  if (missingAccount) {
    const doctor = doctors.find((item) => item.id === missingAccount.order.doctor_id)
    return { error: `医生“${doctor?.name || '未知'}”的收款信息不完整，不能导出` }
  }

  const statementWorkbook = new ExcelJS.Workbook()
  statementWorkbook.creator = '希息药事后台'
  statementWorkbook.created = new Date()
  const statementSheet = statementWorkbook.addWorksheet(
    isManualExport ? '人工结算单' : '月度结算单'
  )
  statementSheet.columns = [
    { header: '导出批次号', key: 'export_no', width: 22 },
    { header: '结算单号', key: 'settlement_no', width: 22 },
    { header: '账期', key: 'settlement_month', width: 12 },
    { header: '结算类型', key: 'settlement_type', width: 14 },
    { header: '医生姓名', key: 'doctor_name', width: 14 },
    { header: '手机号', key: 'doctor_phone', width: 16 },
    { header: '身份证号', key: 'id_card_no', width: 22 },
    { header: '开户行', key: 'bank_name', width: 24 },
    { header: '银行卡号', key: 'bank_card_no', width: 24 },
    { header: '本期积分', key: 'current_points', width: 14 },
    { header: '递延积分', key: 'carryover_points', width: 14 },
    { header: '结算总积分', key: 'total_points', width: 16 },
    { header: '结算金额(元)', key: 'amount_yuan', width: 16 },
    { header: '来源月份', key: 'source_months', width: 20 },
    { header: '审核条数', key: 'review_count', width: 12 },
    { header: '结算状态', key: 'settlement_status', width: 14 },
    { header: '到账结果', key: 'payment_result', width: 14 },
    { header: '到账时间', key: 'paid_at', width: 20 },
    { header: '银行流水号', key: 'transaction_no', width: 24 },
    { header: '失败原因', key: 'failure_reason', width: 28 }
  ]

  preparedOrders.forEach(({ order, paymentSnapshot }) => {
    const doctor = doctors.find((item) => item.id === order.doctor_id)
    statementSheet.addRow({
      export_no: exportNo,
      settlement_no: order.settlement_no,
      settlement_month:
        monthlySettlementCycles.find((item) => item.id === order.cycle_id)
          ?.settlement_month || order.calculation_month || '',
      settlement_type:
        order.settlement_type === 'manual'
          ? '人工结算'
          : '系统月结',
      doctor_name: doctor?.name || '',
      doctor_phone: doctor?.phone || '',
      id_card_no: paymentSnapshot.id_card_no,
      bank_name: paymentSnapshot.bank_name,
      bank_card_no: paymentSnapshot.bank_card_no,
      current_points: Number(order.current_month_amount_cent || 0) / 100,
      carryover_points: Number(order.carryover_amount_cent || 0) / 100,
      total_points: Number(order.amount_cent || 0) / 100,
      amount_yuan: Number(order.amount_cent || 0) / 100,
      source_months: order.source_months.join('、'),
      review_count: order.review_count,
      settlement_status: '已导出',
      payment_result: '',
      paid_at: '',
      transaction_no: '',
      failure_reason: ''
    })
  })
  ;['doctor_phone', 'id_card_no', 'bank_card_no', 'settlement_no'].forEach((key) => {
    statementSheet.getColumn(key).numFmt = '@'
  })
  ;['current_points', 'carryover_points', 'total_points', 'amount_yuan'].forEach(
    (key) => {
      statementSheet.getColumn(key).numFmt = '0.00'
    }
  )
  styleSettlementWorksheet(statementSheet)

  const detailWorkbook = new ExcelJS.Workbook()
  detailWorkbook.creator = '希息药事后台'
  detailWorkbook.created = new Date()
  const detailSheet = detailWorkbook.addWorksheet(
    isManualExport ? '人工结算明细' : '医生结算明细'
  )
  detailSheet.columns = [
    { header: '导出批次号', key: 'export_no', width: 22 },
    { header: '结算单号', key: 'settlement_no', width: 22 },
    { header: '医生ID', key: 'doctor_id', width: 12 },
    { header: '医生姓名', key: 'doctor_name', width: 14 },
    { header: '手机号', key: 'doctor_phone', width: 16 },
    { header: '来源月份', key: 'source_month', width: 12 },
    { header: '基金会', key: 'foundation_name', width: 24 },
    { header: '所属项目', key: 'project_name', width: 24 },
    { header: '项目标识', key: 'identifier_name', width: 22 },
    { header: '任务编号', key: 'task_no', width: 20 },
    { header: '审核记录编号', key: 'review_no', width: 22 },
    { header: '审核档位', key: 'final_level', width: 12 },
    { header: '本条积分', key: 'points', width: 12 },
    { header: '药品名称', key: 'drug_name', width: 22 },
    { header: '药品规格', key: 'drug_specification', width: 22 },
    { header: '问题类型', key: 'type_name', width: 18 },
    { header: '审核问题', key: 'question', width: 42 },
    { header: '问题对应答案', key: 'answer', width: 54 },
    { header: '审核结论', key: 'review_result', width: 14 },
    { header: '不通过类型', key: 'issue_type', width: 18 },
    { header: '审核意见', key: 'review_comment', width: 36 },
    { header: '审核完成时间', key: 'earned_at', width: 20 }
  ]

  orders.forEach((order) => {
    const doctor = doctors.find((item) => item.id === order.doctor_id)
    ledgerRowsForOrder(order.id).forEach((line) => {
      const review = reviews.find((item) => item.id === line.review_id)
      detailSheet.addRow({
        export_no: exportNo,
        settlement_no: order.settlement_no,
        doctor_id: order.doctor_id,
        doctor_name: doctor?.name || '',
        doctor_phone: doctor?.phone || '',
        source_month: line.source_month,
        foundation_name: line.foundation_name,
        project_name: line.project_name,
        identifier_name: line.identifier_name,
        task_no: line.task_no,
        review_no: line.review_no,
        final_level: line.final_level,
        points: Number(line.amount_cent || 0) / 100,
        drug_name: review?.drug_name || '',
        drug_specification: review?.drug_specification || '',
        type_name: review?.type_name || '',
        question: review?.question || '',
        answer: formatReviewAnswer(review?.answer),
        review_result: review?.result === 'rejected' ? '修改' : '赞同',
        issue_type: reviewIssueTypeLabels[review?.issue_type] || '',
        review_comment: review?.review_comment || '',
        earned_at: line.earned_at
      })
    })
  })
  ;['settlement_no', 'doctor_phone', 'review_no', 'task_no'].forEach((key) => {
    detailSheet.getColumn(key).numFmt = '@'
  })
  detailSheet.getColumn('points').numFmt = '0.00'
  styleSettlementWorksheet(detailSheet)

  return {
    statement_buffer: Buffer.from(await statementWorkbook.xlsx.writeBuffer()),
    detail_buffer: Buffer.from(await detailWorkbook.xlsx.writeBuffer()),
    payment_snapshots: new Map(
      preparedOrders.map((item) => [item.order.id, item.paymentSnapshot])
    )
  }
}

function excelCellText(cell) {
  if (!cell) return ''
  if (cell.text !== undefined && cell.text !== null) return String(cell.text).trim()
  const value = cell.value
  if (value === undefined || value === null) return ''
  if (typeof value === 'object' && value.result !== undefined) {
    return String(value.result ?? '').trim()
  }
  return String(value).trim()
}

async function parseMonthlySettlementResultWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount < 2) return { error: '名单中没有可回写的结算记录' }

  const headers = []
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headers[columnNumber - 1] = excelCellText(cell)
  })
  const required = ['结算单号', '结算金额(元)', '到账结果']
  const indexes = Object.fromEntries(
    required.map((header) => [header, headers.indexOf(header)])
  )
  if (required.some((header) => indexes[header] < 0)) {
    return { error: '模板字段不完整，必须包含结算单号、结算金额(元)和到账结果' }
  }

  const optionalIndexes = {
    paid_at: headers.indexOf('到账时间'),
    transaction_no: headers.indexOf('银行流水号'),
    failure_reason: headers.indexOf('失败原因')
  }
  const rows = []
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const values = headers.map((_, index) => excelCellText(row.getCell(index + 1)))
    if (values.every((value) => !value)) continue
    rows.push({
      row_no: rowNumber,
      settlement_no: values[indexes['结算单号']],
      amount_yuan: values[indexes['结算金额(元)']],
      payment_result: values[indexes['到账结果']],
      paid_at:
        optionalIndexes.paid_at >= 0 ? values[optionalIndexes.paid_at] : '',
      transaction_no:
        optionalIndexes.transaction_no >= 0
          ? values[optionalIndexes.transaction_no]
          : '',
      failure_reason:
        optionalIndexes.failure_reason >= 0
          ? values[optionalIndexes.failure_reason]
          : ''
    })
  }
  return { rows }
}

function validateMonthlySettlementResultRows(rows = [], cycleId) {
  const counts = new Map()
  rows.forEach((row) => {
    if (!row.settlement_no) return
    counts.set(row.settlement_no, (counts.get(row.settlement_no) || 0) + 1)
  })

  return rows.map((row) => {
    const order = monthlySettlementOrders.find(
      (item) => item.settlement_no === row.settlement_no
    )
    const amountCent = Math.round(Number(row.amount_yuan) * 100)
    let validationStatus = 'eligible'
    let validationMessage = '校验通过，可更新结算结果'

    if (!row.settlement_no) {
      validationStatus = 'invalid'
      validationMessage = '结算单号不能为空'
    } else if ((counts.get(row.settlement_no) || 0) > 1) {
      validationStatus = 'invalid'
      validationMessage = '结算单号在名单中重复'
    } else if (!order) {
      validationStatus = 'invalid'
      validationMessage = '系统中不存在该结算单'
    } else if (order.cycle_id !== Number(cycleId)) {
      validationStatus = 'invalid'
      validationMessage = '该结算单不属于当前账期'
    } else if (order.status === 'paid') {
      validationStatus = 'skipped'
      validationMessage = '该结算单已经到账，无需重复回写'
    } else if (!['exported', 'payment_failed'].includes(order.status)) {
      validationStatus = 'invalid'
      validationMessage = '只有已导出的结算单才能回写到账结果'
    } else if (!Number.isFinite(amountCent) || amountCent !== order.amount_cent) {
      validationStatus = 'invalid'
      validationMessage = '到账金额与系统结算金额不一致'
    } else if (!['已到账', '失败'].includes(row.payment_result)) {
      validationStatus = 'invalid'
      validationMessage = '到账结果必须填写“已到账”或“失败”'
    } else if (
      row.payment_result === '已到账' &&
      (!row.paid_at || !row.transaction_no)
    ) {
      validationStatus = 'invalid'
      validationMessage = '已到账记录必须填写到账时间和银行流水号'
    } else if (
      row.payment_result === '已到账' &&
      !isValidDateTimeText(row.paid_at)
    ) {
      validationStatus = 'invalid'
      validationMessage = '到账时间必须为有效的 YYYY-MM-DD HH:mm:ss'
    } else if (
      row.payment_result === '已到账' &&
      row.transaction_no.length > 80
    ) {
      validationStatus = 'invalid'
      validationMessage = '银行流水号不能超过 80 个字符'
    } else if (row.payment_result === '失败' && !row.failure_reason) {
      validationStatus = 'invalid'
      validationMessage = '失败记录必须填写失败原因'
    } else if (
      row.payment_result === '失败' &&
      row.failure_reason.length > 200
    ) {
      validationStatus = 'invalid'
      validationMessage = '失败原因不能超过 200 个字符'
    }

    return {
      ...row,
      order_id: order?.id || null,
      doctor_name: order
        ? doctors.find((item) => item.id === order.doctor_id)?.name || ''
        : '',
      current_status: order?.status || '',
      validation_status: validationStatus,
      validation_message: validationMessage
    }
  })
}

function markMonthlySettlementOrderPaid(order, { paidAt, transactionNo, operator }) {
  const settledAt = paidAt || formatDateTime()
  order.status = 'paid'
  order.paid_at = settledAt
  order.transaction_no = transactionNo
  order.payment_failed_reason = ''
  ledgerRowsForOrder(order.id).forEach((item) => {
    item.status = 'settled'
    item.settled_at = settledAt
  })
  monthlySettlementAuditLogs.push({
    id: monthlySettlementAuditLogs.length + 1,
    action: 'payment_confirmed',
    order_id: order.id,
    operator: operator || '运营管理员',
    remark: transactionNo ? `银行流水号：${transactionNo}` : '',
    create_time: formatDateTime()
  })
}

function markMonthlySettlementOrderFailed(order, { reason, operator }) {
  order.status = 'payment_failed'
  order.payment_failed_reason = reason
  monthlySettlementAuditLogs.push({
    id: monthlySettlementAuditLogs.length + 1,
    action: 'payment_failed',
    order_id: order.id,
    operator: operator || '运营管理员',
    remark: reason,
    create_time: formatDateTime()
  })
}

function taskDisplayTitle(task) {
  return `药品知识库审核 · ${task.import_batch_no || task.task_no}`
}

function buildPricingSummary(levelSummary = {}) {
  return ['A', 'B', 'C'].map((level) => {
    const count = Number(levelSummary[level]) || 0
    const unitRewardCent = UNIT_REWARD_CENT[level]
    return {
      level,
      count,
      unit_reward_cent: unitRewardCent,
      subtotal_reward_cent: count * unitRewardCent
    }
  })
}

function hydrateTask(task, options = {}) {
  const includeItems = options?.includeItems === true
  const doctor = doctors.find((item) => item.id === task.doctor_id)
  const orgChain = task.identifier_id
    ? resolveTaskOrgChain(task.identifier_id)
    : null
  const hydrated = {
    ...task,
    pricing_version: task.pricing_version || 'V5.0',
    display_title: taskDisplayTitle(task),
    import_date: taskImportDate(task),
    doctor_name: doctor?.name || task.doctor_name,
    doctor_phone: doctor?.phone || task.doctor_phone,
    hospital: doctor?.hospital || task.hospital,
    department: doctor?.department || task.department,
    account_status: doctor?.account_status || task.account_status,
    foundation_name: orgChain ? orgChain.foundation.name : '',
    project_name: orgChain ? orgChain.project.name : '',
    identifier_name: orgChain ? orgChain.identifier.name : ''
  }

  if (task.level_summary) {
    hydrated.pricing_summary = buildPricingSummary(task.level_summary)
  }

  if (includeItems) {
    hydrated.task_items = taskItems
      .filter((item) => item.task_id === task.id)
      .sort((left, right) => left.sequence - right.sequence)
  }

  return hydrated
}

function taskProgressStatus(task) {
  const itemCount = Math.max(Number(task.item_count) || 0, 0)
  const completedCount = Math.min(
    Math.max(Number(task.completed_count) || 0, 0),
    itemCount
  )
  if (itemCount > 0 && completedCount >= itemCount) return 'completed'
  if (completedCount > 0) return 'in_progress'
  return 'pending'
}

function getTaskBatchKey(task) {
  const batchNo = getTaskBatchNo(task)
  return task.source_type === 'import' && task.import_batch_no
    ? `import:${batchNo}`
    : `manual:${batchNo}`
}

function summarizeTaskBatch(tasksInBatch, batchKey) {
  const hydratedTasks = tasksInBatch.map(hydrateTask)
  const firstTask = hydratedTasks[0] || {}
  const itemCount = hydratedTasks.reduce(
    (total, task) => total + Math.max(Number(task.item_count) || 0, 0),
    0
  )
  const completedCount = hydratedTasks.reduce(
    (total, task) =>
      total +
      Math.min(
        Math.max(Number(task.completed_count) || 0, 0),
        Math.max(Number(task.item_count) || 0, 0)
      ),
    0
  )
  const statusSummary = { pending: 0, in_progress: 0, completed: 0 }
  hydratedTasks.forEach((task) => {
    statusSummary[taskProgressStatus(task)] += 1
  })
  const doctorKeys = new Set(
    hydratedTasks.map((task) => String(task.doctor_id || task.doctor_phone || task.doctor_name))
  )
  const createTime = hydratedTasks
    .map((task) => task.create_time)
    .filter(Boolean)
    .sort()
    .at(-1) || null
  const organizationRows = hydratedTasks
    .map((task) => ({
      foundation_name: task.foundation_name || '',
      project_name: task.project_name || '',
      identifier_name: task.identifier_name || ''
    }))
    .filter(
      (organization) =>
        organization.foundation_name ||
        organization.project_name ||
        organization.identifier_name
    )
  const firstOrganization = organizationRows[0] || {}
  const organizationKey = (organization) =>
    [
      organization.foundation_name,
      organization.project_name,
      organization.identifier_name
    ].join('|')
  const hasMultipleOrganizations =
    new Set(organizationRows.map(organizationKey)).size > 1
  const sourceType = firstTask.source_type === 'import' ? 'import' : 'manual'
  const isImportBatch = sourceType === 'import' && Boolean(firstTask.import_batch_no)
  const batchNo = getTaskBatchNo(firstTask)

  return {
    id: batchKey,
    batch_key: batchKey,
    batch_no: batchNo,
    display_title: isImportBatch ? `名单导入项目 ${batchNo}` : `手工创建项目 ${batchNo}`,
    source_type: sourceType,
    import_date: isImportBatch ? firstTask.import_date || null : null,
    foundation_name: hasMultipleOrganizations
      ? '多个基金会'
      : firstOrganization.foundation_name || '',
    project_name: hasMultipleOrganizations
      ? '多个项目'
      : firstOrganization.project_name || '',
    identifier_name: hasMultipleOrganizations
      ? '多个项目标识'
      : firstOrganization.identifier_name || '',
    doctor_count: doctorKeys.size,
    task_count: hydratedTasks.length,
    item_count: itemCount,
    completed_count: completedCount,
    progress_percent: itemCount ? Math.round((completedCount / itemCount) * 100) : 0,
    status:
      statusSummary.completed === hydratedTasks.length
        ? 'completed'
        : completedCount > 0
          ? 'in_progress'
          : 'pending',
    status_summary: statusSummary,
    total_reward_cent: hydratedTasks.reduce(
      (total, task) => total + Number(task.total_reward_cent || 0),
      0
    ),
    create_time: createTime,
    task_ids: hydratedTasks.map((task) => task.id)
  }
}

function getTaskBatchGroups() {
  const groups = new Map()
  tasks.forEach((task) => {
    const batchKey = getTaskBatchKey(task)
    const group = groups.get(batchKey) || []
    group.push(task)
    groups.set(batchKey, group)
  })
  return groups
}

function buildTaskBatches() {
  return [...getTaskBatchGroups().entries()]
    .map(([batchKey, batchTasks]) => summarizeTaskBatch(batchTasks, batchKey))
    .sort((left, right) => String(right.create_time || '').localeCompare(String(left.create_time || '')))
}

function buildTaskBatchDoctors(batchTasks) {
  const doctorGroups = new Map()
  batchTasks.map(hydrateTask).forEach((task) => {
    const doctorKey = String(task.doctor_id || task.doctor_phone || task.doctor_name)
    const row = doctorGroups.get(doctorKey) || {
      id: doctorKey,
      doctor_id: task.doctor_id,
      doctor_name: task.doctor_name || '',
      doctor_phone: task.doctor_phone || '',
      hospital: task.hospital || '',
      department: task.department || '',
      account_status: task.account_status || '',
      foundation_name: task.foundation_name || '',
      project_name: task.project_name || '',
      identifier_name: task.identifier_name || '',
      task_count: 0,
      item_count: 0,
      completed_count: 0,
      total_reward_cent: 0,
      task_ids: [],
      task_nos: [],
      create_time: task.create_time || null
    }
    row.task_count += 1
    row.item_count += Math.max(Number(task.item_count) || 0, 0)
    row.completed_count += Math.min(
      Math.max(Number(task.completed_count) || 0, 0),
      Math.max(Number(task.item_count) || 0, 0)
    )
    row.total_reward_cent += Number(task.total_reward_cent || 0)
    row.task_ids.push(task.id)
    row.task_nos.push(task.task_no)
    if (String(task.create_time || '') > String(row.create_time || '')) {
      row.create_time = task.create_time
    }
    doctorGroups.set(doctorKey, row)
  })

  return [...doctorGroups.values()]
    .map((row) => ({
      ...row,
      progress_percent: row.item_count
        ? Math.round((row.completed_count / row.item_count) * 100)
        : 0,
      status:
        row.item_count > 0 && row.completed_count >= row.item_count
          ? 'completed'
          : row.completed_count > 0
            ? 'in_progress'
            : 'pending'
    }))
    .sort((left, right) => String(left.doctor_name).localeCompare(String(right.doctor_name), 'zh-CN'))
}

function findTaskBatch(batchKey) {
  const normalizedKey = String(batchKey || '').trim()
  if (!normalizedKey) return null
  const batchTasks = getTaskBatchGroups().get(normalizedKey)
  if (!batchTasks || batchTasks.length === 0) return null
  const batch = summarizeTaskBatch(batchTasks, normalizedKey)
  return {
    ...batch,
    doctors: buildTaskBatchDoctors(batchTasks)
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
  const accruedRewardCent = pointLedger
    .filter((item) => item.doctor_id === doctor.id)
    .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
  const paymentAccount = getDoctorPaymentAccount(doctor.id)
  const unsettledRewardCent = pointLedger
    .filter(
      (item) =>
        item.doctor_id === doctor.id &&
        item.status === 'unsettled' &&
        !item.settlement_order_id
    )
    .reduce((total, item) => total + Number(item.amount_cent || 0), 0)
  const result = {
    ...doctor,
    task_count: taskCount,
    assigned_item_count: assignedItemCount,
    completed_item_count: completedItemCount,
    accrued_reward_cent: accruedRewardCent,
    unsettled_reward_cent: unsettledRewardCent,
    payment_account_status: isPaymentAccountComplete(paymentAccount)
      ? 'complete'
      : paymentAccount
        ? 'incomplete'
        : 'missing',
    last_task_time: doctorTasks[0]?.create_time || null
  }

  if (includeTasks) {
    result.recent_tasks = doctorTasks.slice(0, 5)
  }

  return result
}

function hydrateDoctorCertification(doctor, includeMaterials = false) {
  const certification = doctorCertifications.find(
    (record) => record.doctor_id === doctor.id
  )
  const result = {
    ...hydrateDoctor(doctor),
    certification_id: certification?.id || null,
    certificate_type: certification?.certificate_type || '',
    certificate_holder_name: certification ? doctor.name : '',
    id_card_number_masked: certification
      ? mockIdentityCardNumber(doctor.id)
      : '',
    certificate_attachment_name: certification
      ? `${certification.certificate_type || '证件'}-${doctor.name}.jpg`
      : '',
    certification_submit_time: certification?.submit_time || null,
    certification_review_time: certification?.review_time || null,
    certification_reviewer: certification?.reviewer || '',
    certification_reject_reason: certification?.reject_reason || ''
  }

  if (includeMaterials && certification) {
    result.certificate_image_url = certificatePreviewImage(doctor, certification)
  }

  return result
}

function validateTargetPoints(value) {
  const targetPoints = Number(value)

  if (!Number.isInteger(targetPoints) || targetPoints < 100) {
    return { error: '项目积分须为不小于 100 的整数' }
  }

  if (targetPoints % 100 !== 0) {
    return { error: '项目积分须为 100 的整数倍' }
  }

  return { targetPoints }
}

function doctorReviewEligibilityError(doctor) {
  if (doctor.training_exam_status !== 'passed') {
    return '该医生尚未通过审核培训与考试，无法分配项目'
  }

  if (!['A', 'B', 'C'].includes(doctor.max_review_level)) {
    return '该医生的审核等级资格未配置'
  }

  return ''
}

function planTaskQuestions(questionRows, targetPoints, doctor, seed) {
  const validation = validateTargetPoints(targetPoints)
  if (validation.error) {
    return { success: false, reason: validation.error }
  }

  const rewardCent = validation.targetPoints * 100
  const plan = planQuestionAllocation(questionRows, rewardCent, {
    maxLevel: doctor?.max_review_level || 'C',
    seed,
    doctorId: doctor?.id
  })

  if (!plan.success) {
    const availablePoints = Math.floor(Number(plan.available_points || 0) / 100)
    return {
      success: false,
      reason: `题库无法精确匹配 ${validation.targetPoints} 积分，当前可分配总额为 ${availablePoints} 积分`
    }
  }

  return {
    success: true,
    target_points: validation.targetPoints,
    total_reward_cent: rewardCent,
    rows: plan.rows,
    level_summary: plan.level_summary,
    matched_item_count: plan.rows.length
  }
}

function createTask(
  doctor,
  plan,
  sourceType,
  importBatchNo = null,
  importDate = null,
  orgChain = null
) {
  const id = nextTaskId
  nextTaskId += 1
  const createTime = formatDateTime()
  const datePart = createTime.slice(0, 10).replaceAll('-', '')
  const task = {
    id,
    task_no: `RW${datePart}${String(id).padStart(4, '0')}`,
    doctor_id: doctor.id,
    doctor_name: doctor.name,
    doctor_phone: doctor.phone,
    hospital: doctor.hospital,
    department: doctor.department,
    account_status: doctor.account_status,
    foundation_id: orgChain ? orgChain.foundation.id : null,
    project_id: orgChain ? orgChain.project.id : null,
    identifier_id: orgChain ? orgChain.identifier.id : null,
    source_type: sourceType,
    import_batch_no: importBatchNo,
    import_date: importDate,
    target_points: plan.target_points,
    item_count: plan.matched_item_count,
    completed_count: 0,
    unit_reward_cent: null,
    total_reward_cent: plan.total_reward_cent,
    level_summary: { ...plan.level_summary },
    pricing_version: 'V5.0',
    pricing_model: 'question_level',
    allocation_rule: 'random_exact_value_no_fixed_ratio',
    settlement_cycle: 'monthly_next_month',
    status: 'pending',
    create_time: createTime,
    start_time: null,
    complete_time: null
  }

  recordQuestionAllocation(questionBankRows, plan.rows, doctor.id)
  plan.rows.forEach((question, index) => {
    taskItems.push({
      id: nextTaskItemId,
      task_id: id,
      sequence: index + 1,
      question_id: question.id,
      question_no: question.question_no,
      drug_id: question.drug_id,
      drug_image_url: question.drug_image_url,
      drug_name: question.drug_name,
      drug_specification: question.drug_specification,
      drug_type: question.drug_type,
      drug_manufacturer: question.drug_manufacturer,
      disease_type: question.disease_type || '',
      department: question.department || '',
      type_code: question.type_code,
      type_name: question.type_name,
      question: question.question,
      answer: JSON.parse(JSON.stringify(question.answer)),
      source_reference: JSON.parse(JSON.stringify(question.source_reference)),
      risk_tags: [...question.risk_tags],
      risk_tag_names: resolveRiskTagNames(
        question.risk_tags,
        questionBankFixture.risk_tag_labels
      ),
      base_level: question.base_level,
      final_level: question.final_level,
      upgrade_reasons: [...question.upgrade_reasons],
      unit_reward_cent: question.unit_reward_cent,
      status: 'pending',
      reviewer_id: null,
      review_result: null,
      correction_content: null,
      reviewed_at: null,
      assigned_at: createTime
    })
    nextTaskItemId += 1
  })

  return task
}

function normalizeImportDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (part) => String(part).padStart(2, '0')
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
      value.getUTCDate()
    )}`
  }

  const text = String(value || '').trim()
  const match = text.match(/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[3])
  const day = Number(match[4])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function excelCellValue(cell) {
  const value = cell?.value
  if (value == null) return ''
  if (value instanceof Date) return normalizeImportDate(value) || ''

  if (typeof value === 'number' && /[ymd]/i.test(String(cell.numFmt || ''))) {
    const timestamp = Math.round((value - 25569) * 86400 * 1000)
    return normalizeImportDate(new Date(timestamp)) || ''
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || '').join('')
    }
    if ('result' in value) return String(value.result ?? '').trim()
    if ('text' in value) return String(value.text ?? '').trim()
  }

  return String(value).trim()
}

async function readTaskImportRows(payload = {}) {
  const fileName = String(payload.file_name || '').trim()
  const fileSize = Number(payload.file_size)
  const isXlsx = /\.xlsx$/i.test(fileName)
  const isCsv = /\.csv$/i.test(fileName)

  if (!fileName) return { error: '请选择要导入的名单文件' }
  if (!isXlsx && !isCsv) return { error: '名单导入仅支持 XLSX 或 CSV 文件' }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { error: '无法读取文件大小，请重新选择文件' }
  }
  if (fileSize > 10 * 1024 * 1024) return { error: '名单文件不能超过 10 MB' }

  if (isCsv) {
    const fileContent = String(payload.file_content || '')
    if (!fileContent.trim()) return { error: '无法读取 CSV 文件内容' }
    if (Buffer.byteLength(fileContent, 'utf8') > 10 * 1024 * 1024) {
      return { error: '名单文件不能超过 10 MB' }
    }

    try {
      return { rows: parseCsv(fileContent) }
    } catch {
      return { error: 'CSV 文件格式不正确，请检查引号和换行后重试' }
    }
  }

  const base64Content = String(payload.file_content_base64 || '').trim()
  if (!base64Content) return { error: '无法读取 XLSX 文件内容' }

  try {
    const buffer = Buffer.from(base64Content, 'base64')
    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
      return { error: '名单文件不能超过 10 MB' }
    }
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return { error: 'XLSX 文件中没有可读取的工作表' }

    const columnCount = Math.max(worksheet.columnCount, 4)
    const rows = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = []
      for (let column = 1; column <= columnCount; column += 1) {
        values.push(excelCellValue(row.getCell(column)))
      }
      if (values.some((value) => String(value).trim() !== '')) rows.push(values)
    })
    return { rows }
  } catch {
    return { error: 'XLSX 文件无法解析，请使用最新模板重新填写' }
  }
}

function emptyLevelCounts() {
  return { A: 0, B: 0, C: 0 }
}

function addLevelCounts(target, source) {
  ;['A', 'B', 'C'].forEach((level) => {
    target[level] += Number(source?.[level]) || 0
  })
  return target
}

function analyzeTaskImportRows(sourceRows, fileName, seed) {
  if (!Array.isArray(sourceRows) || sourceRows.length < 2) {
    return { error: '名单中没有可导入的数据' }
  }

  const header = sourceRows[0].map((value) => String(value || '').trim())
  const nameIndex = header.findIndex((value) => ['姓名', '医生姓名'].includes(value))
  const phoneIndex = header.indexOf('手机号')
  const pointsIndex = header.findIndex((value) => ['项目积分', '任务积分', '目标积分'].includes(value))
  const dateIndex = header.findIndex((value) => ['创建日期', '导入日期', '日期'].includes(value))
  const foundationIndex = header.findIndex((value) =>
    ['基金会名称', '基金会'].includes(value)
  )
  const projectNameIndex = header.findIndex((value) =>
    ['项目名称', '项目'].includes(value)
  )
  const identifierIndex = header.findIndex((value) =>
    ['项目标识', '项目标识名称', '标识名称'].includes(value)
  )

  if (
    [
      nameIndex,
      phoneIndex,
      pointsIndex,
      dateIndex,
      foundationIndex,
      projectNameIndex,
      identifierIndex
    ].some((index) => index < 0)
  ) {
    return {
      error:
        '模板字段不完整，必须包含医生姓名、手机号、项目积分、创建日期、基金会名称、项目名称和项目标识'
    }
  }

  const phoneDateRows = new Map()
  const phoneNames = new Map()
  const phoneFirstRow = new Map()
  sourceRows.slice(1).forEach((values, index) => {
    const phone = String(values[phoneIndex] || '').trim()
    if (!phone) return
    const rowNo = index + 2
    if (!phoneFirstRow.has(phone)) phoneFirstRow.set(phone, rowNo)

    const name = String(values[nameIndex] || '').trim()
    if (name) {
      const names = phoneNames.get(phone) || new Set()
      names.add(name)
      phoneNames.set(phone, names)
    }

    const createDate = normalizeImportDate(values[dateIndex])
    if (!createDate) return
    const key = `${phone}|${createDate}`
    const rowNumbers = phoneDateRows.get(key) || []
    rowNumbers.push(rowNo)
    phoneDateRows.set(key, rowNumbers)
  })

  const simulatedQuestions = questionBankRows.map((row) => ({
    ...row,
    assigned_doctor_ids: [...(row.assigned_doctor_ids || [])]
  }))
  const rows = sourceRows.slice(1).map((values, index) => {
    const rowNo = index + 2
    const doctorName = String(values[nameIndex] || '').trim()
    const doctorPhone = String(values[phoneIndex] || '').trim()
    const pointsText = String(values[pointsIndex] || '').trim()
    const targetPoints = Number(pointsText)
    const createDateText = String(values[dateIndex] || '').trim()
    const createDate = normalizeImportDate(values[dateIndex])
    const foundationName = String(values[foundationIndex] || '').trim()
    const projectName = String(values[projectNameIndex] || '').trim()
    const identifierName = String(values[identifierIndex] || '').trim()
    const errors = []

    if (!doctorName) errors.push('医生姓名不能为空')
    else if (doctorName.length > 30) errors.push('医生姓名不能超过 30 个字符')
    if (!/^1[3-9]\d{9}$/.test(doctorPhone)) errors.push('手机号须为 11 位有效号码')

    const pointsValidation = validateTargetPoints(targetPoints)
    if (!/^\d+$/.test(pointsText) || pointsValidation.error) {
      errors.push(pointsValidation.error || '项目积分须为正整数')
    }

    if (!createDateText) errors.push('创建日期不能为空')
    else if (!createDate) errors.push('创建日期须为有效日期，例如 2026-08-05')

    let orgChain = null
    if (!foundationName) {
      errors.push('基金会名称不能为空')
    } else if (!projectName) {
      errors.push('项目名称不能为空')
    } else if (!identifierName) {
      errors.push('项目标识不能为空')
    } else {
      const foundation = projectOrgRows.foundation.find(
        (row) => row.name === foundationName
      )
      if (!foundation) {
        errors.push(`基金会“${foundationName}”不存在，请先到组织管理维护`)
      } else {
        const project = projectOrgRows.project.find(
          (row) => row.foundation_id === foundation.id && row.name === projectName
        )
        if (!project) {
          errors.push(
            `基金会“${foundationName}”下不存在项目“${projectName}”，请先到组织管理维护`
          )
        } else {
          const identifier = projectOrgRows.identifier.find(
            (row) => row.project_id === project.id && row.name === identifierName
          )
          if (!identifier) {
            errors.push(
              `项目“${projectName}”下不存在项目标识“${identifierName}”，请先到组织管理维护`
            )
          } else {
            const orgDisabledError = taskOrgDisabledError({
              foundation,
              project,
              identifier
            })
            if (orgDisabledError) {
              errors.push(orgDisabledError)
            } else {
              orgChain = { foundation, project, identifier }
            }
          }
        }
      }
    }

    if (
      doctorPhone &&
      createDate &&
      (phoneDateRows.get(`${doctorPhone}|${createDate}`)?.length || 0) > 1
    ) {
      errors.push('该医生同一创建日期在名单中重复')
    }
    if (doctorPhone && (phoneNames.get(doctorPhone)?.size || 0) > 1) {
      errors.push('同一手机号在名单中的姓名不一致')
    }
    if (createDate && findImportedTask(doctorPhone, createDate)) {
      errors.push(`该医生在 ${createDate} 已导入过项目，请勿重复导入`)
    }

    const doctor = doctors.find((item) => item.phone === doctorPhone)
    if (doctor && doctor.name !== doctorName) errors.push(`手机号已绑定医生“${doctor.name}”`)
    if (doctor?.account_status === 'disabled') errors.push('医生账号已禁用，不能分配新项目')
    const eligibilityError = doctor ? doctorReviewEligibilityError(doctor) : ''
    if (eligibilityError) errors.push(eligibilityError)

    const accountAction =
      doctor || phoneFirstRow.get(doctorPhone) !== rowNo ? 'reuse' : 'create'
    let plan = null
    if (errors.length === 0) {
      const allocationDoctor =
        doctor || { id: `IMPORT:${doctorPhone}`, max_review_level: 'C' }
      plan = planTaskQuestions(
        simulatedQuestions,
        targetPoints,
        allocationDoctor,
        `${seed}|${fileName}|${rowNo}|${doctorPhone}`
      )
      if (!plan.success) {
        errors.push(plan.reason)
      } else {
        recordQuestionAllocation(simulatedQuestions, plan.rows, allocationDoctor.id)
      }
    }

    const valid = errors.length === 0
    return {
      row_no: rowNo,
      doctor_name: doctorName,
      doctor_phone: doctorPhone,
      target_points: Number.isFinite(targetPoints) ? targetPoints : 0,
      create_date: createDate || createDateText,
      import_date: createDate || createDateText,
      foundation_name: orgChain ? orgChain.foundation.name : foundationName,
      project_name: orgChain ? orgChain.project.name : projectName,
      identifier_name: orgChain ? orgChain.identifier.name : identifierName,
      foundation_id: orgChain ? orgChain.foundation.id : null,
      project_id: orgChain ? orgChain.project.id : null,
      identifier_id: orgChain ? orgChain.identifier.id : null,
      matched_item_count: valid ? plan.matched_item_count : 0,
      item_count: valid ? plan.matched_item_count : 0,
      level_summary: valid ? { ...plan.level_summary } : emptyLevelCounts(),
      total_reward_cent: valid ? plan.total_reward_cent : 0,
      question_ids: valid ? plan.rows.map((question) => question.id) : [],
      account_action: accountAction,
      validation_status: valid ? 'valid' : 'invalid',
      validation_message: valid
        ? accountAction === 'reuse'
          ? '校验通过，将复用已有账号'
          : '校验通过，将创建已通过培训考试的医生账号'
        : errors.join('；')
    }
  })

  const validRows = rows.filter((row) => row.validation_status === 'valid')
  const levelSummary = validRows.reduce(
    (summary, row) => addLevelCounts(summary, row.level_summary),
    emptyLevelCounts()
  )
  const matchedItemCount = validRows.reduce(
    (total, row) => total + row.matched_item_count,
    0
  )
  const totalTargetPoints = validRows.reduce(
    (total, row) => total + row.target_points,
    0
  )

  return {
    rows,
    summary: {
      total_rows: rows.length,
      valid_rows: validRows.length,
      error_rows: rows.length - validRows.length,
      new_account_count: validRows.filter((row) => row.account_action === 'create').length,
      reused_account_count: validRows.filter((row) => row.account_action === 'reuse').length,
      task_count: validRows.length,
      total_target_points: totalTargetPoints,
      matched_item_count: matchedItemCount,
      total_item_count: matchedItemCount,
      total_reward_cent: totalTargetPoints * 100,
      level_summary: levelSummary
    }
  }
}

function taskImportDate(task) {
  if (task.source_type !== 'import') return null
  return task.import_date || String(task.create_time || '').slice(0, 10) || null
}

function findImportedTask(doctorPhone, importDate) {
  if (!doctorPhone || !importDate) return null
  return (
    tasks.find(
      (task) =>
        task.doctor_phone === doctorPhone && taskImportDate(task) === importDate
    ) || null
  )
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

app.get('/mock-files/disclosures/:fileId/:fileName', (req, res) => {
  const document = disclosureDocumentsByFileId.get(String(req.params.fileId))
  if (!document) {
    res.status(404).json(failure(404, '公示文档不存在或已失效'))
    return
  }

  const fileBuffer = document.buffer || buildMockDisclosurePdf()
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `inline; filename="disclosure.pdf"; filename*=UTF-8''${encodeURIComponent(document.name)}`
  )
  res.send(fileBuffer)
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

app.post(
  '/core/system/uploadFile',
  express.raw({
    type: 'multipart/form-data',
    limit: disclosureDocumentMaxSize + 1024 * 1024
  }),
  (req, res) => {
    const file = parseMultipartFile(req.body, req.get('Content-Type'))
    if (!file) {
      res.json(failure(422, '未读取到上传文件，请重新选择 PDF 文件'))
      return
    }

    const fileName = safeDisclosureFileName(file.name)
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      res.json(failure(422, '公示文档仅支持 PDF 格式'))
      return
    }
    if (file.mime_type && file.mime_type.toLowerCase() !== 'application/pdf') {
      res.json(failure(422, '文件内容不是有效的 PDF，请重新选择'))
      return
    }
    if (file.buffer.length > disclosureDocumentMaxSize) {
      res.json(failure(422, 'PDF 文件不能超过 10 MB，请压缩后重新上传'))
      return
    }
    if (file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      res.json(failure(422, '文件内容不是有效的 PDF，请重新选择'))
      return
    }

    const fileId = `PD${Date.now()}${String(
      Math.floor(Math.random() * 1000)
    ).padStart(3, '0')}`
    const url = `/dev/mock-files/disclosures/${fileId}/${encodeURIComponent(fileName)}`
    const document = {
      file_id: fileId,
      url,
      name: fileName,
      size: file.buffer.length,
      upload_time: formatDateTime(),
      buffer: file.buffer
    }
    disclosureDocuments.set(url, document)
    disclosureDocumentsByFileId.set(fileId, document)

    res.json(
      success(
        {
          url: document.url,
          name: document.name,
          size: document.size,
          mime_type: 'application/pdf',
          upload_time: document.upload_time
        },
        '公示文档上传成功'
      )
    )
  }
)

app.use('/core/product', requireAuth)

app.get('/core/product/doctor-config/index', (req, res) => {
  const type = String(req.query.type || '').trim()
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status =
    req.query.status === 'all' ? '' : String(req.query.status || '').trim()

  if (!doctorConfigTypes.includes(type)) {
    res.json(failure(422, '请选择有效的配置类型'))
    return
  }

  if (status && !['1', '2'].includes(status)) {
    res.json(failure(422, '状态筛选值无效'))
    return
  }

  const filteredRows = doctorConfigRows
    .filter((item) => {
      if (item.type !== type) return false
      if (status && item.status !== status) return false
      if (!keyword) return true

      return [item.name, item.region, item.level, item.remark]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort(
      (left, right) =>
        Number(left.sort) - Number(right.sort) || Number(left.id) - Number(right.id)
    )

  res.json(success(paginate(filteredRows, req.query)))
})

app.post('/core/product/doctor-config/save', (req, res) => {
  const normalized = normalizeDoctorConfigPayload(req.body)

  if (normalized.error) {
    res.json(failure(422, normalized.error))
    return
  }

  const duplicate = doctorConfigRows.find(
    (item) =>
      item.type === normalized.data.type &&
      item.name.toLowerCase() === normalized.data.name.toLowerCase()
  )

  if (duplicate) {
    res.json(
      failure(
        422,
        `${doctorConfigTypeLabels[normalized.data.type]}名称已存在，请勿重复添加`
      )
    )
    return
  }

  const now = formatDateTime()
  const item = {
    id: nextDoctorConfigId,
    ...normalized.data,
    create_time: now,
    update_time: now
  }
  nextDoctorConfigId += 1
  doctorConfigRows.push(item)

  res.json(
    success(item, `${doctorConfigTypeLabels[item.type]}新增成功`)
  )
})

app.put('/core/product/doctor-config/update', (req, res) => {
  const id = Number(req.query.id)

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的配置 ID'))
    return
  }

  const item = doctorConfigRows.find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, '未找到对应配置'))
    return
  }

  const normalized = normalizeDoctorConfigPayload(req.body, item.type)
  if (normalized.error) {
    res.json(failure(422, normalized.error))
    return
  }

  if (normalized.data.type !== item.type) {
    res.json(failure(422, '不能修改配置类型'))
    return
  }

  const duplicate = doctorConfigRows.find(
    (row) =>
      row.id !== id &&
      row.type === item.type &&
      row.name.toLowerCase() === normalized.data.name.toLowerCase()
  )

  if (duplicate) {
    res.json(
      failure(422, `${doctorConfigTypeLabels[item.type]}名称已存在，请更换名称`)
    )
    return
  }

  Object.assign(item, normalized.data, { update_time: formatDateTime() })
  res.json(success(item, `${doctorConfigTypeLabels[item.type]}保存成功`))
})

app.delete('/core/product/doctor-config/destroy', (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(Number))].filter(
        (id) => Number.isInteger(id) && id > 0
      )
    : []

  if (ids.length === 0) {
    res.json(failure(422, '请选择要删除的配置'))
    return
  }

  const beforeCount = doctorConfigRows.length
  doctorConfigRows = doctorConfigRows.filter((item) => !ids.includes(item.id))
  const deletedCount = beforeCount - doctorConfigRows.length

  if (deletedCount === 0) {
    res.json(failure(404, '未找到要删除的配置'))
    return
  }

  res.json(
    success({ deleted_count: deletedCount }, `已删除 ${deletedCount} 项配置`)
  )
})

app.post('/core/product/doctor-config/changeStatus', (req, res) => {
  const id = Number(req.body?.id)
  const status = String(req.body?.status || '')

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的配置 ID'))
    return
  }

  if (!['1', '2'].includes(status)) {
    res.json(failure(422, '状态值无效'))
    return
  }

  const item = doctorConfigRows.find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, '未找到对应配置'))
    return
  }

  item.status = status
  item.update_time = formatDateTime()
  res.json(
    success(
      { id: item.id, status: item.status, update_time: item.update_time },
      `${doctorConfigTypeLabels[item.type]}已${status === '1' ? '启用' : '停用'}`
    )
  )
})

app.get('/core/product/project-org/tree', (req, res) => {
  res.json(
    success({
      counts: {
        foundation: projectOrgRows.foundation.length,
        project: projectOrgRows.project.length,
        identifier: projectOrgRows.identifier.length
      },
      tree: buildProjectOrgTree()
    })
  )
})

app.get('/core/product/project-org/index', (req, res) => {
  const type = String(req.query.type || '').trim()
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status =
    req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const foundationId = Number(req.query.foundation_id) || 0
  const projectId = Number(req.query.project_id) || 0

  if (!Object.keys(projectOrgTypeLabels).includes(type)) {
    res.json(failure(422, '请选择有效的层级类型'))
    return
  }

  if (status && !['1', '2'].includes(status)) {
    res.json(failure(422, '状态筛选值无效'))
    return
  }

  if (
    foundationId &&
    !projectOrgRows.foundation.some((row) => row.id === foundationId)
  ) {
    res.json(failure(404, '所选基金会不存在，请刷新后重试'))
    return
  }

  if (projectId && !projectOrgRows.project.some((row) => row.id === projectId)) {
    res.json(failure(404, '所选项目不存在，请刷新后重试'))
    return
  }

  const filteredRows = projectOrgRows[type]
    .filter((item) => {
      if (type === 'project' && foundationId && item.foundation_id !== foundationId) {
        return false
      }
      if (type === 'identifier' && projectId && item.project_id !== projectId) {
        return false
      }
      if (type === 'identifier' && foundationId) {
        const parent = projectOrgRows.project.find(
          (row) => row.id === item.project_id
        )
        if (!parent || parent.foundation_id !== foundationId) {
          return false
        }
      }
      if (status && item.status !== status) {
        return false
      }
      if (!keyword) {
        return true
      }

      return [item.name, item.code, item.remark]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .map((item) => enrichProjectOrgRow(type, item))
    .sort((left, right) => Number(left.id) - Number(right.id))

  res.json(success(paginate(filteredRows, req.query)))
})

app.post('/core/product/project-org/save', (req, res) => {
  const type = String(req.body?.type || '').trim()
  const normalized = normalizeProjectOrgPayload(req.body)

  if (normalized.error) {
    res.json(failure(422, normalized.error))
    return
  }

  const typeLabel = projectOrgTypeLabels[type]

  if (type === 'project') {
    const foundation = projectOrgRows.foundation.find(
      (row) => row.id === normalized.data.foundation_id
    )
    if (foundation.status === '2') {
      res.json(failure(422, '所属基金会已停用，请先启用基金会后再新增项目'))
      return
    }
  }

  if (type === 'identifier') {
    const project = projectOrgRows.project.find(
      (row) => row.id === normalized.data.project_id
    )
    if (project.status === '2') {
      res.json(failure(422, '所属项目已停用，请先启用项目后再新增标识'))
      return
    }
  }

  const duplicate = findProjectOrgDuplicate(type, normalized.data)
  if (duplicate) {
    res.json(failure(422, `${typeLabel}名称已存在，请勿重复添加`))
    return
  }

  const codeDuplicate = findProjectOrgCodeDuplicate(type, normalized.data)
  if (codeDuplicate) {
    res.json(failure(422, `${typeLabel}编码已存在，请更换编码`))
    return
  }

  const now = formatDateTime()
  const item = {
    id: nextProjectOrgId[type],
    ...normalized.data,
    create_time: now,
    update_time: now
  }
  nextProjectOrgId[type] += 1
  projectOrgRows[type].push(item)

  res.json(success(enrichProjectOrgRow(type, item), `${typeLabel}新增成功`))
})

app.put('/core/product/project-org/update', (req, res) => {
  const type = String(req.body?.type || '').trim()
  const id = Number(req.query.id)

  if (!Object.keys(projectOrgTypeLabels).includes(type)) {
    res.json(failure(422, '层级类型无效'))
    return
  }

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的数据 ID'))
    return
  }

  const item = projectOrgRows[type].find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, `未找到对应${projectOrgTypeLabels[type]}`))
    return
  }

  const normalized = normalizeProjectOrgPayload(req.body)
  if (normalized.error) {
    res.json(failure(422, normalized.error))
    return
  }

  if (
    type === 'project' &&
    normalized.data.foundation_id !== item.foundation_id
  ) {
    res.json(failure(422, '不能修改项目的所属基金会'))
    return
  }

  if (
    type === 'identifier' &&
    normalized.data.project_id !== item.project_id
  ) {
    res.json(failure(422, '不能修改项目标识的所属项目'))
    return
  }

  const duplicate = findProjectOrgDuplicate(type, normalized.data, id)
  if (duplicate) {
    res.json(
      failure(422, `${projectOrgTypeLabels[type]}名称已存在，请更换名称`)
    )
    return
  }

  const codeDuplicate = findProjectOrgCodeDuplicate(type, normalized.data, id)
  if (codeDuplicate) {
    res.json(failure(422, `${projectOrgTypeLabels[type]}编码已存在，请更换编码`))
    return
  }

  Object.assign(item, normalized.data, { update_time: formatDateTime() })
  res.json(
    success(enrichProjectOrgRow(type, item), `${projectOrgTypeLabels[type]}保存成功`)
  )
})

app.delete('/core/product/project-org/destroy', (req, res) => {
  const type = String(req.body?.type || '').trim()

  if (!Object.keys(projectOrgTypeLabels).includes(type)) {
    res.json(failure(422, '层级类型无效'))
    return
  }

  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(Number))].filter(
        (id) => Number.isInteger(id) && id > 0
      )
    : []

  if (ids.length === 0) {
    res.json(failure(422, '请选择要删除的数据'))
    return
  }

  if (type === 'foundation') {
    const projectCount = projectOrgRows.project.filter((row) =>
      ids.includes(row.foundation_id)
    ).length
    if (projectCount > 0) {
      res.json(
        failure(422, '所选基金会下还存在项目，请先删除或迁移项目后再删除基金会')
      )
      return
    }
  }

  if (type === 'project') {
    const identifierCount = projectOrgRows.identifier.filter((row) =>
      ids.includes(row.project_id)
    ).length
    if (identifierCount > 0) {
      res.json(
        failure(422, '所选项目下还存在项目标识，请先删除项目标识后再删除项目')
      )
      return
    }
  }

  const beforeCount = projectOrgRows[type].length
  projectOrgRows[type] = projectOrgRows[type].filter(
    (item) => !ids.includes(item.id)
  )
  const deletedCount = beforeCount - projectOrgRows[type].length

  if (deletedCount === 0) {
    res.json(failure(404, '未找到要删除的数据'))
    return
  }

  res.json(
    success({ deleted_count: deletedCount }, `已删除 ${deletedCount} 项数据`)
  )
})

app.post('/core/product/project-org/changeStatus', (req, res) => {
  const type = String(req.body?.type || '').trim()
  const id = Number(req.body?.id)
  const status = String(req.body?.status || '')

  if (!Object.keys(projectOrgTypeLabels).includes(type)) {
    res.json(failure(422, '层级类型无效'))
    return
  }

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的数据 ID'))
    return
  }

  if (!['1', '2'].includes(status)) {
    res.json(failure(422, '状态值无效'))
    return
  }

  const item = projectOrgRows[type].find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, `未找到对应${projectOrgTypeLabels[type]}`))
    return
  }

  item.status = status
  item.update_time = formatDateTime()
  res.json(
    success(
      { id: item.id, status: item.status, update_time: item.update_time },
      `${projectOrgTypeLabels[type]}已${status === '1' ? '启用' : '停用'}`
    )
  )
})

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
  const paymentAccountStatus =
    req.query.payment_account_status === 'all'
      ? ''
      : String(req.query.payment_account_status || '').trim()
  if (accountStatus && !doctorAccountStatuses.includes(accountStatus)) {
    res.json(failure(422, '账号状态筛选值无效'))
    return
  }

  if (
    certificationStatus &&
    !doctorCertificationStatuses.includes(certificationStatus)
  ) {
    res.json(failure(422, '认证状态筛选值无效'))
    return
  }
  if (
    paymentAccountStatus &&
    !paymentAccountStatuses.includes(paymentAccountStatus)
  ) {
    res.json(failure(422, '收款信息状态筛选值无效'))
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
      if (
        paymentAccountStatus &&
        doctor.payment_account_status !== paymentAccountStatus
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

app.post('/core/product/doctor/save', (req, res) => {
  const name = String(req.body?.name || '').trim()
  const phone = String(req.body?.phone || '').trim()
  const gender = String(req.body?.gender || '').trim()
  const hospital = String(req.body?.hospital || '').trim()
  const department = String(req.body?.department || '').trim()
  const title = String(req.body?.title || '').trim()

  if (!name || name.length > 30) {
    res.json(failure(422, '请输入医生姓名（不超过 30 个字符）'))
    return
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    res.json(failure(422, '请输入 11 位有效手机号'))
    return
  }

  if (!['male', 'female'].includes(gender)) {
    res.json(failure(422, '请选择医生性别'))
    return
  }

  if ([hospital, department, title].some((value) => value.length > 80)) {
    res.json(failure(422, '执业信息单项不能超过 80 个字符'))
    return
  }

  const existing = doctors.find((item) => item.phone === phone)
  if (existing) {
    res.json(
      failure(409, `手机号 ${phone} 已绑定医生“${existing.name}”，请勿重复创建`)
    )
    return
  }

  const doctor = {
    id: nextDoctorId,
    name,
    phone,
    hospital: hospital || '待补充',
    department: department || '待补充',
    title: title || '待补充',
    gender,
    account_status: 'pending_activation',
    certification_status: 'unsubmitted',
    training_exam_status: 'passed',
    max_review_level: 'C',
    review_qualification_source: 'admin_manual_roster',
    account_source: 'manual',
    create_time: formatDateTime(),
    activation_time: null,
    last_login_time: null
  }
  nextDoctorId += 1
  doctors.push(doctor)
  updateWorkbench(0, 1)

  res.json(
    success(
      hydrateDoctor(doctor),
      '医生账号已创建，请通知医生使用该手机号登录小程序激活'
    )
  )
})

app.post('/core/product/doctor/status', (req, res) => {
  const id = Number(req.body?.id)
  const action = String(req.body?.action || '').trim()

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的医生 ID'))
    return
  }

  if (!['disable', 'enable'].includes(action)) {
    res.json(failure(422, '请选择有效的账号操作'))
    return
  }

  const doctor = doctors.find((item) => item.id === id)
  if (!doctor) {
    res.json(failure(404, '未找到对应医生'))
    return
  }

  if (action === 'disable' && doctor.account_status === 'disabled') {
    res.json(failure(409, '医生账号已处于禁用状态'))
    return
  }

  if (action === 'enable' && doctor.account_status !== 'disabled') {
    res.json(failure(409, '医生账号当前不是禁用状态'))
    return
  }

  doctor.account_status =
    action === 'disable'
      ? 'disabled'
      : doctor.activation_time
        ? 'active'
        : 'pending_activation'

  workbenchFixture.doctors.active = doctors.filter(
    (item) => item.account_status === 'active'
  ).length
  workbenchFixture.doctors.pending_activation = doctors.filter(
    (item) => item.account_status === 'pending_activation'
  ).length
  workbenchFixture.doctors.disabled = doctors.filter(
    (item) => item.account_status === 'disabled'
  ).length
  workbenchFixture.updated_at = formatDateTime()

  const restoredLabel =
    doctor.account_status === 'active' ? '已激活' : '待激活'
  res.json(
    success(
      hydrateDoctor(doctor),
      action === 'disable'
        ? '医生账号已禁用'
        : `医生账号已开启，恢复为${restoredLabel}`
    )
  )
})

app.post('/core/product/doctor/exportPendingActivation', (req, res) => {
  const pendingDoctors = doctors
    .filter((doctor) => doctor.account_status === 'pending_activation')
    .map((doctor) => hydrateDoctor(doctor))
    .sort((left, right) => left.id - right.id)

  if (pendingDoctors.length === 0) {
    res.json(failure(422, '当前没有待激活的医生账号'))
    return
  }

  const exportTime = formatDateTime()
  const sourceLabels = {
    import: '名单导入',
    manual: '手动分配项目',
    mini_program: '小程序注册'
  }
  const rows = [
    ['姓名', '手机号', '待接项目数', '待接审核条数', '账号创建时间', '账号来源'],
    ...pendingDoctors.map((doctor) => [
      doctor.name,
      toExcelText(doctor.phone, /^\d{11}$/),
      doctor.task_count,
      Math.max(doctor.assigned_item_count - doctor.completed_item_count, 0),
      doctor.create_time,
      sourceLabels[doctor.account_source] || doctor.account_source
    ])
  ]
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const exportBatch = exportTime.replaceAll(/[-: ]/g, '')

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="pending-doctors-${exportBatch}.csv"`
  )
  res.send(`﻿${csv}`)
})

app.get('/core/product/doctor-certification/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const accountStatus =
    req.query.account_status === 'all'
      ? ''
      : String(req.query.account_status || '').trim()
  const certificationStatus =
    req.query.certification_status === 'all'
      ? ''
      : String(req.query.certification_status || '').trim()

  if (accountStatus && !doctorAccountStatuses.includes(accountStatus)) {
    res.json(failure(422, '账号状态筛选值无效'))
    return
  }

  if (
    certificationStatus &&
    !doctorCertificationStatuses.includes(certificationStatus)
  ) {
    res.json(failure(422, '认证状态筛选值无效'))
    return
  }

  const statusOrder = {
    pending: 0,
    rejected: 1,
    approved: 2,
    unsubmitted: 3
  }
  const filteredDoctors = doctors
    .map(hydrateDoctorCertification)
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
        doctor.title,
        doctor.certificate_type
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((left, right) => {
      const statusDifference =
        statusOrder[left.certification_status] -
        statusOrder[right.certification_status]
      if (statusDifference !== 0) return statusDifference
      return String(right.certification_submit_time || '').localeCompare(
        String(left.certification_submit_time || '')
      )
    })

  res.json(success(paginate(filteredDoctors, req.query)))
})

app.get('/core/product/doctor-certification/read', (req, res) => {
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

  res.json(success(hydrateDoctorCertification(doctor, true)))
})

app.post('/core/product/doctor-certification/review', (req, res) => {
  const id = Number(req.body?.id)
  const result = String(req.body?.result || '').trim()
  const reason = String(req.body?.reason || '').trim()
  const materialConfirmed = req.body?.material_confirmed === true

  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的医生 ID'))
    return
  }

  if (!['approved', 'rejected'].includes(result)) {
    res.json(failure(422, '请选择有效的认证结果'))
    return
  }

  if (result === 'approved' && !materialConfirmed) {
    res.json(failure(422, '请确认已完成认证材料核对'))
    return
  }

  if (result === 'rejected' && !reason) {
    res.json(failure(422, '请输入认证不通过原因'))
    return
  }

  if (reason.length > 200) {
    res.json(failure(422, '认证不通过原因不能超过 200 个字符'))
    return
  }

  const doctor = doctors.find((item) => item.id === id)
  if (!doctor) {
    res.json(failure(404, '未找到对应医生'))
    return
  }

  const certification = doctorCertifications.find(
    (record) => record.doctor_id === id
  )
  if (!certification || doctor.certification_status === 'unsubmitted') {
    res.json(failure(409, '医生尚未提交认证资料'))
    return
  }

  if (doctor.certification_status !== 'pending') {
    res.json(failure(409, '当前认证状态不可重复审核'))
    return
  }

  const reviewTime = formatDateTime()
  certification.status = result
  certification.review_time = reviewTime
  certification.reviewer = '运营管理员'
  certification.reject_reason = result === 'rejected' ? reason : ''
  doctor.certification_status = result
  syncCertificationWorkbench()

  res.json(
    success(
      hydrateDoctorCertification(doctor, true),
      result === 'approved' ? '医生认证已通过' : '医生认证已驳回'
    )
  )
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
    res.json(failure(422, '不通过类型筛选值无效'))
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
        review.question_no,
        review.task_no,
        review.doctor_name,
        review.doctor_phone,
        review.hospital,
        review.department,
        review.drug_name,
        review.drug_specification,
        review.drug_manufacturer,
        review.drug_type,
        review.disease_type,
        review.question_department,
        review.type_name,
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

app.get('/core/product/settlement/summary', (req, res) => {
  res.json(success(buildMonthlySettlementSummary()))
})

app.get('/core/product/settlement/job/index', (req, res) => {
  const month = normalizeSettlementMonth(req.query.month)
  const rawMonth = String(req.query.month || '').trim()
  const triggerType = String(req.query.trigger_type || '').trim()
  const status = String(req.query.status || '').trim()
  if (rawMonth && !month) {
    res.json(failure(422, '账期格式必须为 YYYY-MM'))
    return
  }
  if (triggerType && !['automatic', 'manual'].includes(triggerType)) {
    res.json(failure(422, '任务触发方式无效'))
    return
  }
  if (status && !['success', 'failed'].includes(status)) {
    res.json(failure(422, '任务状态无效'))
    return
  }
  const rows = monthlySettlementJobLogs.filter((item) => {
    if (month && item.settlement_month !== month) return false
    if (triggerType && item.trigger_type !== triggerType) return false
    if (status && item.status !== status) return false
    return true
  })
  res.json(success(paginate(rows, req.query)))
})

app.get('/core/product/settlement/history/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const month = normalizeSettlementMonth(req.query.month)
  const rawMonth = String(req.query.month || '').trim()
  const status = req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const recordType = String(req.query.record_type || '').trim()
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)

  if (rawMonth && !month) {
    res.json(failure(422, '账期格式必须为 YYYY-MM'))
    return
  }
  if (status && !settlementHistoryStatuses.includes(status)) {
    res.json(failure(422, '结算状态筛选值无效'))
    return
  }
  if (recordType && !['monthly_cycle', 'manual_settlement'].includes(recordType)) {
    res.json(failure(422, '记录类型筛选值无效'))
    return
  }
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
    res.json(failure(422, '分页参数必须为正整数'))
    return
  }

  const rows = buildSettlementHistoryRows().filter((item) => {
    if (month && item.settlement_month !== month) return false
    if (status && item.status !== status) return false
    if (recordType && item.record_type !== recordType) return false
    if (!keyword) return true
    return [
      item.record_no,
      item.display_title,
      item.settlement_month,
      item.doctor_name,
      item.doctor_phone_masked,
      item.result_message,
      item.manual_reason
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })

  res.json(success(paginate(rows, { page, limit })))
})

app.get('/core/product/settlement/cycle/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const month = normalizeSettlementMonth(req.query.month)
  const rawMonth = String(req.query.month || '').trim()
  const status = req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)

  if (rawMonth && !month) {
    res.json(failure(422, '账期格式必须为 YYYY-MM'))
    return
  }
  if (status && !monthlySettlementCycleStatuses.includes(status)) {
    res.json(failure(422, '月结状态筛选值无效'))
    return
  }
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
    res.json(failure(422, '分页参数必须为正整数'))
    return
  }

  const rows = buildMonthlySettlementHistoryRows()
    .filter((item) => {
      if (month && item.settlement_month !== month) return false
      if (status && item.status !== status) return false
      if (!keyword) return true
      return [item.cycle_no, item.display_title, item.settlement_month].some(
        (value) => String(value || '').toLowerCase().includes(keyword)
      )
    })
    .sort((left, right) =>
      String(right.settlement_month).localeCompare(String(left.settlement_month))
    )

  res.json(success(paginate(rows, { page, limit })))
})

app.get('/core/product/settlement/cycle/read', (req, res) => {
  const id = Number(req.query.id)
  const cycleNo = String(req.query.cycle_no || '').trim()
  const cycle = monthlySettlementCycles.find(
    (item) =>
      (Number.isInteger(id) && id > 0 && item.id === id) ||
      (cycleNo && item.cycle_no === cycleNo)
  )
  if (!cycle) {
    res.json(failure(404, '未找到对应月结账期'))
    return
  }
  res.json(success(toPublicMonthlySettlementCycle(cycle, true)))
})

app.post('/core/product/settlement/cycle/run', (req, res) => {
  const month = normalizeSettlementMonth(req.body?.month)
  if (!month) {
    res.json(failure(422, '请提供 YYYY-MM 格式的月结账期'))
    return
  }
  const executedAt = formatDateTime()
  const result = runMonthlySettlementCycle(month, executedAt)
  if (result.error) {
    res.json(failure(422, result.error))
    return
  }
  const job = recordMonthlySettlementJob({
    month,
    executedAt,
    triggerType: 'manual',
    result
  })
  syncMonthlySettlementWorkbench()
  if (!result.cycle) {
    res.json(
      success(
        { created_count: 0, cycle: null, job },
        '当前账期没有可结算积分，未生成月结记录'
      )
    )
    return
  }
  res.json(
    success(
      {
        created_count: result.created_count,
        cycle: toPublicMonthlySettlementCycle(result.cycle, true),
        job
      },
      result.created_count > 0
        ? `本次纳入 ${result.created_count} 位医生`
        : '月结任务已执行，无需重复生成'
    )
  )
})

app.get('/core/product/settlement/order/read', (req, res) => {
  const id = Number(req.query.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的结算单 ID'))
    return
  }
  const order = monthlySettlementOrders.find((item) => item.id === id)
  if (!order) {
    res.json(failure(404, '未找到对应医生结算单'))
    return
  }
  res.json(success(toPublicMonthlySettlementOrder(order, true)))
})

app.get('/core/product/settlement/paymentAccount', (req, res) => {
  const doctorId = Number(req.query.doctor_id)
  const doctor = doctors.find((item) => item.id === doctorId)
  if (!doctor) {
    res.json(failure(404, '未找到对应医生'))
    return
  }
  res.json(
    success({
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      account: toPublicPaymentAccount(getDoctorPaymentAccount(doctor.id))
    })
  )
})

app.put('/core/product/settlement/paymentAccount', (req, res) => {
  const doctorId = Number(req.body?.doctor_id)
  const doctor = doctors.find((item) => item.id === doctorId)
  const payeeName = String(req.body?.payee_name || '').trim()
  const idCardNo = String(req.body?.id_card_no || '').trim()
  const bankName = String(req.body?.bank_name || '').trim()
  const bankCardNo = String(req.body?.bank_card_no || '').replaceAll(' ', '')
  const confirmed = req.body?.confirmed === true

  if (!doctor) {
    res.json(failure(404, '未找到对应医生'))
    return
  }
  if (!payeeName || payeeName.length > 50) {
    res.json(failure(422, '请输入不超过 50 个字符的收款人姓名'))
    return
  }
  if (!/^\d{17}[\dXx]$/.test(idCardNo)) {
    res.json(failure(422, '请输入 18 位有效身份证号'))
    return
  }
  if (!bankName || bankName.length > 100) {
    res.json(failure(422, '请输入不超过 100 个字符的开户行'))
    return
  }
  if (!/^\d{16,19}$/.test(bankCardNo)) {
    res.json(failure(422, '请输入 16 至 19 位银行卡号'))
    return
  }
  if (!confirmed) {
    res.json(failure(422, '请确认已核对收款人、身份证号和银行卡信息'))
    return
  }

  const now = formatDateTime()
  const current = getDoctorPaymentAccount(doctor.id)
  const account = current || {
    id: doctor.id,
    doctor_id: doctor.id
  }
  Object.assign(account, {
    payee_name: payeeName,
    id_card_no: idCardNo.toUpperCase(),
    bank_name: bankName,
    bank_card_no: bankCardNo,
    status: 'complete',
    source: 'admin',
    confirmed_by: '运营管理员',
    confirmed_at: now,
    update_time: now
  })
  if (!current) doctorPaymentAccounts.push(account)

  monthlySettlementOrders
    .filter(
      (item) => item.doctor_id === doctor.id && item.status === 'pending_export'
    )
    .forEach((item) => {
      item.payment_snapshot = toPublicPaymentAccount(account, true)
    })
  syncMonthlySettlementWorkbench()
  res.json(
    success(
      {
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        account: toPublicPaymentAccount(account)
      },
      '收款信息已补录并确认'
    )
  )
})

app.get('/core/product/settlement/manual/candidates', (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit)
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
    res.json(failure(422, '分页参数必须为正整数'))
    return
  }
  const rows = buildManualSettlementCandidates(req.query.keyword)
  res.json(success(paginate(rows, { page, limit })))
})

app.post('/core/product/settlement/order/manual', (req, res) => {
  const result = createManualMonthlySettlement({
    doctorId: req.body?.doctor_id,
    reason: req.body?.reason,
    operator: '运营管理员'
  })
  if (result.error) {
    res.json(failure(422, result.error))
    return
  }
  res.json(
    success(
      toPublicMonthlySettlementOrder(result.order, true),
      '人工单独结算单已生成'
    )
  )
})

app.post('/core/product/settlement/export/create', async (req, res) => {
  const rawCycleId = req.body?.cycle_id
  const hasCycleId = ![undefined, null, ''].includes(rawCycleId)
  const cycleId = Number(rawCycleId)
  const orderIds = Array.isArray(req.body?.order_ids)
    ? [...new Set(req.body.order_ids.map(Number))].filter(
        (id) => Number.isInteger(id) && id > 0
      )
    : []
  const cycle = hasCycleId
    ? monthlySettlementCycles.find((item) => item.id === cycleId)
    : null
  if (hasCycleId && !cycle) {
    res.json(failure(404, '未找到对应月结账期'))
    return
  }
  if (orderIds.length === 0) {
    res.json(failure(422, '请选择要导出的医生结算单'))
    return
  }
  const orders = monthlySettlementOrders.filter(
    (item) =>
      orderIds.includes(item.id) &&
      (cycle
        ? item.cycle_id === cycle.id
        : item.cycle_id === null && item.settlement_type === 'manual') &&
      ['pending_export', 'payment_failed'].includes(item.status)
  )
  if (orders.length !== orderIds.length) {
    res.json(failure(422, '所选结算单状态已变化，请刷新后重新选择'))
    return
  }

  const now = formatDateTime()
  const isManualExport = !cycle
  const doctorCount = new Set(orders.map((item) => item.doctor_id)).size
  const exportNo = `${isManualExport ? 'RGEX' : 'YJEX'}${now.slice(0, 10).replaceAll('-', '')}${String(
    nextMonthlySettlementExportId
  ).padStart(4, '0')}`
  let files
  try {
    files = await buildMonthlySettlementExportFiles(orders, exportNo)
  } catch {
    res.json(failure(500, '结算文件生成失败，请稍后重试'))
    return
  }
  if (files.error) {
    res.json(failure(422, files.error))
    return
  }

  nextMonthlySettlementExportId += 1
  const settlementMonth = cycle?.settlement_month || orders[0].calculation_month
  const statementName = `${isManualExport ? '人工结算单' : '月度结算单'}-${settlementMonth}-${exportNo}.xlsx`
  const detailName = `${isManualExport ? '人工结算明细' : '医生结算明细'}-${settlementMonth}-${exportNo}.xlsx`
  monthlySettlementExports.set(exportNo, {
    export_no: exportNo,
    cycle_id: cycle?.id || null,
    order_ids: orders.map((item) => item.id),
    statement_name: statementName,
    detail_name: detailName,
    statement_buffer: files.statement_buffer,
    detail_buffer: files.detail_buffer,
    created_at: now
  })
  orders.forEach((order) => {
    order.status = 'exported'
    order.exported_at = now
    order.export_id = exportNo
    order.payment_snapshot = files.payment_snapshots.get(order.id)
    monthlySettlementAuditLogs.push({
      id: monthlySettlementAuditLogs.length + 1,
      action: 'exported',
      order_id: order.id,
      operator: '运营管理员',
      remark: `导出批次：${exportNo}`,
      create_time: now
    })
  })
  syncMonthlySettlementWorkbench()
  res.json(
    success(
      {
        export_no: exportNo,
        file_count: 2,
        doctor_count: doctorCount,
        order_count: orders.length,
        statement_name: statementName,
        detail_name: detailName,
        statement_url: `/core/product/settlement/export/download?export_no=${exportNo}&file=statement`,
        detail_url: `/core/product/settlement/export/download?export_no=${exportNo}&file=detail`
      },
      isManualExport
        ? '已生成 1 份人工结算单和 1 份结算明细'
        : `已生成 1 份月度结算单和 1 份合并结算明细，共 ${doctorCount} 位医生`
    )
  )
})

app.get('/core/product/settlement/export/download', (req, res) => {
  const exportNo = String(req.query.export_no || '').trim()
  const fileType = String(req.query.file || '').trim()
  const item = monthlySettlementExports.get(exportNo)
  if (!item || !['statement', 'detail'].includes(fileType)) {
    res.json(failure(404, '导出文件不存在或已失效'))
    return
  }
  const name = fileType === 'statement' ? item.statement_name : item.detail_name
  const buffer =
    fileType === 'statement' ? item.statement_buffer : item.detail_buffer
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
  )
  res.send(buffer)
})

app.post('/core/product/settlement/resultImportPreview', async (req, res) => {
  const cycleId = Number(req.body?.cycle_id)
  const fileName = String(req.body?.file_name || '').trim()
  const fileSize = Number(req.body?.file_size)
  const fileBase64 = String(req.body?.file_base64 || '').replace(
    /^data:.*?;base64,/,
    ''
  )
  const cycle = monthlySettlementCycles.find((item) => item.id === cycleId)
  if (!cycle) {
    res.json(failure(404, '未找到对应月结账期'))
    return
  }
  if (!/\.xlsx$/i.test(fileName)) {
    res.json(failure(422, '到账结果仅支持系统导出的 XLSX 月度结算单'))
    return
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 10 * 1024 * 1024) {
    res.json(failure(422, '到账结果文件不能为空且不能超过 10 MB'))
    return
  }
  let parsed
  try {
    const buffer = Buffer.from(fileBase64, 'base64')
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      res.json(failure(422, '无法读取到账结果文件，请重新选择'))
      return
    }
    parsed = await parseMonthlySettlementResultWorkbook(buffer)
  } catch {
    res.json(failure(422, 'XLSX 文件无法解析，请使用系统导出的原结算单'))
    return
  }
  if (parsed.error) {
    res.json(failure(422, parsed.error))
    return
  }
  const rows = validateMonthlySettlementResultRows(parsed.rows, cycle.id)
  if (rows.length === 0) {
    res.json(failure(422, '名单中没有可回写的结算记录'))
    return
  }
  const previewId = `YJIP${Date.now()}${String(
    Math.floor(Math.random() * 1000)
  ).padStart(3, '0')}`
  const eligibleRows = rows.filter((item) => item.validation_status === 'eligible')
  const summary = {
    total_rows: rows.length,
    eligible_rows: eligibleRows.length,
    paid_rows: eligibleRows.filter((item) => item.payment_result === '已到账').length,
    failed_rows: eligibleRows.filter((item) => item.payment_result === '失败').length,
    skipped_rows: rows.length - eligibleRows.length
  }
  monthlySettlementImportPreviews.set(previewId, {
    cycle_id: cycle.id,
    file_name: fileName,
    rows,
    summary
  })
  res.json(
    success({
      preview_id: previewId,
      file_name: fileName,
      rows,
      summary
    })
  )
})

app.post('/core/product/settlement/resultImportConfirm', (req, res) => {
  const previewId = String(req.body?.preview_id || '').trim()
  const preview = monthlySettlementImportPreviews.get(previewId)
  if (!preview) {
    res.json(failure(404, '导入预览不存在或已完成，请重新上传'))
    return
  }
  let paidCount = 0
  let failedCount = 0
  let changedStateSkippedCount = 0
  preview.rows
    .filter((item) => item.validation_status === 'eligible')
    .forEach((row) => {
      const order = monthlySettlementOrders.find((item) => item.id === row.order_id)
      if (
        !order ||
        order.cycle_id !== preview.cycle_id ||
        !['exported', 'payment_failed'].includes(order.status)
      ) {
        changedStateSkippedCount += 1
        return
      }
      if (row.payment_result === '已到账') {
        markMonthlySettlementOrderPaid(order, {
          paidAt: row.paid_at,
          transactionNo: row.transaction_no,
          operator: '运营管理员（批量导入）'
        })
        paidCount += 1
      } else {
        markMonthlySettlementOrderFailed(order, {
          reason: row.failure_reason,
          operator: '运营管理员（批量导入）'
        })
        failedCount += 1
      }
    })
  monthlySettlementImportPreviews.delete(previewId)
  if (paidCount === 0 && failedCount === 0) {
    res.json(failure(422, '可更新记录的状态已变化，请重新校验名单'))
    return
  }
  syncMonthlySettlementWorkbench()
  const skippedCount = preview.summary.skipped_rows + changedStateSkippedCount
  res.json(
    success(
      { paid_count: paidCount, failed_count: failedCount, skipped_count: skippedCount },
      `已确认到账 ${paidCount} 笔，记录失败 ${failedCount} 笔，跳过 ${skippedCount} 笔`
    )
  )
})

app.post('/core/product/settlement/order/markPaid', (req, res) => {
  const id = Number(req.body?.id)
  const amountCent = Number(req.body?.amount_cent)
  const paidAt = String(req.body?.paid_at || '').trim()
  const transactionNo = String(req.body?.transaction_no || '').trim()
  const order = monthlySettlementOrders.find((item) => item.id === id)
  if (!order) {
    res.json(failure(404, '未找到对应医生结算单'))
    return
  }
  if (!['exported', 'payment_failed'].includes(order.status)) {
    res.json(failure(409, '只有已导出或打款失败的结算单可以补录到账'))
    return
  }
  if (!Number.isInteger(amountCent) || amountCent !== order.amount_cent) {
    res.json(failure(422, '到账金额必须与结算单金额完全一致'))
    return
  }
  if (!isValidDateTimeText(paidAt)) {
    res.json(failure(422, '请填写有效的 YYYY-MM-DD HH:mm:ss 到账时间'))
    return
  }
  if (!transactionNo || transactionNo.length > 80) {
    res.json(failure(422, '请填写不超过 80 个字符的银行流水号'))
    return
  }
  markMonthlySettlementOrderPaid(order, {
    paidAt,
    transactionNo,
    operator: '运营管理员（单笔补录）'
  })
  syncMonthlySettlementWorkbench()
  res.json(
    success(toPublicMonthlySettlementOrder(order, true), '结算单已更新为已到账')
  )
})

app.get('/core/product/settlement/doctor/overview', (req, res) => {
  const data = buildDoctorSettlementOverview(req.query.doctor_id)
  if (!data) {
    res.json(failure(404, '未找到对应医生'))
    return
  }
  res.json(success(data))
})

app.get('/core/product/settlement/doctor/records', (req, res) => {
  const doctorId = Number(req.query.doctor_id)
  if (!doctors.some((item) => item.id === doctorId)) {
    res.json(failure(404, '未找到对应医生'))
    return
  }
  const rows = monthlySettlementOrders
    .filter((item) => item.doctor_id === doctorId)
    .sort((left, right) =>
      String(right.generated_at).localeCompare(String(left.generated_at))
    )
    .map((item) => toPublicMonthlySettlementOrder(item))
  res.json(success(paginate(rows, req.query)))
})

app.get('/core/product/withdrawal/summary', (req, res) => {
  res.json(success(summarizeSettlementBatches(withdrawals)))
})

app.get('/core/product/withdrawal/batch/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status = req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)

  if (status && !settlementBatchStatuses.includes(status)) {
    res.json(failure(422, '项目结算状态筛选值无效'))
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

  const filteredBatches = buildSettlementBatches(withdrawals)
    .filter((batch) => {
      if (status && batch.status !== status) return false
      if (!keyword) return true

      return [
        batch.batch_no,
        batch.display_title,
        batch.foundation_name,
        batch.project_name,
        batch.identifier_name,
        ...batch.task_settlements.flatMap((item) => [
          item.doctor_name,
          item.hospital
        ])
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
    .map(({ task_settlements: taskSettlements, ...batch }) => batch)
    .sort(
      (left, right) =>
        String(right.created_at || '').localeCompare(String(left.created_at || '')) ||
        right.batch_no.localeCompare(left.batch_no)
    )

  res.json(success(paginate(filteredBatches, { page, limit })))
})

app.get('/core/product/withdrawal/batch/read', (req, res) => {
  const batchNo = String(req.query.batch_no || '').trim()

  if (!batchNo) {
    res.json(failure(422, '请提供项目编号'))
    return
  }

  const batch = buildSettlementBatches(withdrawals).find(
    (item) => item.batch_no === batchNo
  )

  if (!batch) {
    res.json(failure(404, '未找到对应项目的结算记录'))
    return
  }

  res.json(success(batch))
})

app.get('/core/product/withdrawal/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const status = req.query.status === 'all' ? '' : String(req.query.status || '').trim()
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)

  if (status && !withdrawalSettlementStatuses.includes(status)) {
    res.json(failure(422, '结算状态筛选值无效'))
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
      if (status && withdrawal.settlement_status !== status) return false
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

app.post('/core/product/withdrawal/settlementImportPreview', (req, res) => {
  const batchNo = String(req.body?.batch_no || '').trim()
  const fileName = String(req.body?.file_name || '').trim()
  const fileSize = Number(req.body?.file_size)
  const fileContent = String(req.body?.file_content || '')

  if (!batchNo) {
    res.json(failure(422, '请先进入要回写的项目'))
    return
  }

  const targetBatch = buildSettlementBatches(withdrawals).find(
    (item) => item.batch_no === batchNo
  )
  if (!targetBatch) {
    res.json(failure(404, '项目不存在或暂无结算记录，请返回列表后重试'))
    return
  }

  if (!fileName) {
    res.json(failure(422, '请选择要导入的已结算名单'))
    return
  }

  if (!/\.csv$/i.test(fileName)) {
    res.json(failure(422, '已结算名单仅支持 CSV 文件，请使用系统导出的待处理名单'))
    return
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || !fileContent.trim()) {
    res.json(failure(422, '无法读取名单文件，请重新选择'))
    return
  }

  if (
    fileSize > 10 * 1024 * 1024 ||
    Buffer.byteLength(fileContent, 'utf8') > 10 * 1024 * 1024
  ) {
    res.json(failure(422, '已结算名单不能超过 10 MB'))
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
    res.json(failure(422, '名单中没有可更新的结算记录'))
    return
  }

  const header = csvRows[0]
  const withdrawalNoIndex = header.findIndex((value) =>
    ['结算单号', '申请单号', '提现申请单号'].includes(value)
  )
  const settlementStatusIndex = header.indexOf('结算状态')

  if (withdrawalNoIndex < 0 || settlementStatusIndex < 0) {
    res.json(failure(422, '模板字段不完整，必须包含结算单号和结算状态'))
    return
  }

  const withdrawalNoCounts = new Map()
  csvRows.slice(1).forEach((values) => {
    const withdrawalNo = String(values[withdrawalNoIndex] || '').trim()
    if (!withdrawalNo) return
    withdrawalNoCounts.set(
      withdrawalNo,
      (withdrawalNoCounts.get(withdrawalNo) || 0) + 1
    )
  })

  const rows = csvRows.slice(1).map((values, index) => {
    const rowNo = index + 2
    const withdrawalNo = String(values[withdrawalNoIndex] || '').trim()
    const targetStatus = String(values[settlementStatusIndex] || '').trim()
    const withdrawal = withdrawals.find(
      (item) => item.withdrawal_no === withdrawalNo
    )
    const currentStatus = withdrawal?.settlement_status || ''
    let validationStatus = 'eligible'
    let validationMessage = '校验通过，将更新为已结算'

    if (!withdrawalNo) {
      validationStatus = 'invalid'
      validationMessage = '结算单号不能为空，已跳过'
    } else if ((withdrawalNoCounts.get(withdrawalNo) || 0) > 1) {
      validationStatus = 'invalid'
      validationMessage = '结算单号在名单中重复，已跳过'
    } else if (targetStatus !== '已结算') {
      validationStatus = 'invalid'
      validationMessage = '结算状态必须改为“已结算”，已跳过'
    } else if (!withdrawal) {
      validationStatus = 'invalid'
      validationMessage = '系统中不存在该结算记录，已跳过'
    } else if (getWithdrawalTaskBatchNo(withdrawal) !== batchNo) {
      validationStatus = 'invalid'
      validationMessage = '该结算记录不属于当前项目，已跳过'
    } else if (!getSettlementDoctorEligibility(withdrawal).eligible) {
      validationStatus = 'invalid'
      validationMessage = '该医生在当前项目还有审核条数未完成，不能结算，已跳过'
    } else if (currentStatus === 'pending') {
      validationStatus = 'skipped'
      validationMessage = '当前仍为待导出，仅已导出记录可结算，已跳过'
    } else if (currentStatus === 'settled') {
      validationStatus = 'skipped'
      validationMessage = '当前已经结算，无需重复导入，已跳过'
    } else if (currentStatus !== 'exported') {
      validationStatus = 'invalid'
      validationMessage = '当前结算状态异常，已跳过'
    }

    return {
      row_no: rowNo,
      withdrawal_no: withdrawalNo,
      settlement_no: withdrawalNo,
      payee_name: withdrawal?.doctor_name || '',
      target_status: targetStatus,
      current_status: currentStatus,
      validation_status: validationStatus,
      validation_message: validationMessage
    }
  })

  const eligibleRows = rows.filter(
    (row) => row.validation_status === 'eligible'
  )
  const summary = {
    total_rows: rows.length,
    eligible_rows: eligibleRows.length,
    skipped_rows: rows.length - eligibleRows.length,
    pending_rows: rows.filter((row) => row.current_status === 'pending').length,
    settled_rows: rows.filter((row) => row.current_status === 'settled').length,
    invalid_rows: rows.filter((row) => row.validation_status === 'invalid').length
  }
  const previewId = `WS${Date.now()}${String(
    Math.floor(Math.random() * 1000)
  ).padStart(3, '0')}`

  withdrawalSettlementPreviews.set(previewId, {
    batch_no: batchNo,
    file_name: fileName,
    rows,
    summary
  })

  res.json(
    success({
      preview_id: previewId,
      batch_no: batchNo,
      file_name: fileName,
      rows,
      summary
    })
  )
})

app.post('/core/product/withdrawal/settlementImportConfirm', (req, res) => {
  const previewId = String(req.body?.preview_id || '').trim()

  if (!previewId) {
    res.json(failure(422, '缺少导入预览标识，请重新上传名单'))
    return
  }

  const preview = withdrawalSettlementPreviews.get(previewId)

  if (!preview) {
    res.json(failure(404, '导入预览不存在或已完成，请重新上传名单'))
    return
  }

  const eligibleRows = preview.rows.filter(
    (row) => row.validation_status === 'eligible'
  )
  if (eligibleRows.length === 0) {
    res.json(failure(422, '名单中没有可更新的已导出记录'))
    return
  }

  const settledTime = formatDateTime()
  let updatedCount = 0
  let changedStateSkippedCount = 0

  eligibleRows.forEach((row) => {
    const withdrawal = withdrawals.find(
      (item) => item.withdrawal_no === row.withdrawal_no
    )

    if (
      !withdrawal ||
      getWithdrawalTaskBatchNo(withdrawal) !== preview.batch_no ||
      !getSettlementDoctorEligibility(withdrawal).eligible ||
      withdrawal.settlement_status !== 'exported'
    ) {
      changedStateSkippedCount += 1
      return
    }

    withdrawal.settlement_status = 'settled'
    withdrawal.settled_time = settledTime
    updatedCount += 1
  })

  const skippedCount = preview.summary.skipped_rows + changedStateSkippedCount
  withdrawalSettlementPreviews.delete(previewId)
  if (updatedCount === 0) {
    res.json(failure(422, '可结算记录的状态已变化，请重新校验名单后再导入'))
    return
  }

  syncWithdrawalWorkbench()

  res.json(
    success(
      {
        batch_no: preview.batch_no,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        settled_time: updatedCount > 0 ? settledTime : null
      },
      `已更新 ${updatedCount} 条结算记录，跳过 ${skippedCount} 条`
    )
  )
})

function formatReviewAnswer(answer) {
  if (typeof answer === 'string') return answer
  if (!answer || typeof answer !== 'object') return ''

  const sections = [
    ['用药建议', answer.suggestion],
    ['用法用量', answer.dosage],
    ['注意事项', answer.precautions],
    ['药物相互作用', answer.interaction],
    ['就医提醒', answer.warning]
  ]

  return sections
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([label, value]) => {
      const text = Array.isArray(value) ? value.filter(Boolean).join('；') : String(value)
      return `${label}：${text}`
    })
    .join('\n')
}

function buildSettlementReviewRows(batchNo, settlementWithdrawals = []) {
  const reviewRowsByTask = new Map()
  reviews.forEach((review) => {
    const taskId = Number(review.task_id)
    const rows = reviewRowsByTask.get(taskId) || []
    rows.push(review)
    reviewRowsByTask.set(taskId, rows)
  })
  reviewRowsByTask.forEach((rows) => {
    rows.sort(
      (left, right) =>
        String(left.review_time).localeCompare(String(right.review_time)) || left.id - right.id
    )
  })

  const consumedByTask = new Map()
  return settlementWithdrawals.flatMap((withdrawal) => {
    const taskId = Number(withdrawal.source_task_id)
    const taskReviews = reviewRowsByTask.get(taskId) || []
    const consumedCount = consumedByTask.get(taskId) || 0
    const reviewCount = Math.max(Number(withdrawal.source_review_count) || 0, 0)
    const selectedReviews = taskReviews.slice(consumedCount, consumedCount + reviewCount)
    consumedByTask.set(taskId, consumedCount + reviewCount)

    return selectedReviews.map((review) => [
      batchNo,
      withdrawal.withdrawal_no,
      review.review_no,
      review.task_no,
      review.doctor_id,
      review.doctor_name,
      toExcelText(review.doctor_phone, /^\d{11}$/),
      review.hospital,
      review.department,
      review.drug_name,
      review.drug_specification,
      review.drug_manufacturer,
      review.disease_type,
      review.question_department,
      review.type_name,
      review.question,
      formatReviewAnswer(review.answer),
      review.result === 'rejected' ? '修改' : '赞同',
      reviewIssueTypeLabels[review.issue_type] || review.issue_type || '',
      review.review_comment,
      review.review_time
    ])
  })
}

app.post('/core/product/withdrawal/exportReviewRecords', (req, res) => {
  const batchNo = String(req.body?.batch_no || '').trim()

  if (!batchNo) {
    res.json(failure(422, '请提供要导出的项目'))
    return
  }

  const batch = buildSettlementBatches(withdrawals).find(
    (item) => item.batch_no === batchNo
  )
  if (!batch) {
    res.json(failure(404, '项目不存在或暂无结算记录，请返回列表后重试'))
    return
  }

  const pendingWithdrawals = withdrawals
    .filter(
      (withdrawal) =>
        getWithdrawalTaskBatchNo(withdrawal) === batchNo &&
        getSettlementDoctorEligibility(withdrawal).eligible &&
        withdrawal.settlement_status === 'pending'
    )
    .sort(
      (left, right) =>
        left.apply_time.localeCompare(right.apply_time) || left.id - right.id
    )

  if (pendingWithdrawals.length === 0) {
    res.json(failure(422, '当前项目暂无待导出的医生结算记录'))
    return
  }

  const exportTime = formatDateTime()
  const rows = [
    [
      '项目编号',
      '结算单号',
      '审核记录编号',
      '分配编号',
      '医生ID',
      '医生姓名',
      '手机号',
      '医院',
      '科室',
      '药品名称',
      '药品规格',
      '生产厂家',
      '疾病分类',
      '问题科室',
      '问题类型',
      '审核问题',
      '问题对应答案',
      '审核结论',
      '不通过类型',
      '审核意见',
      '审核时间'
    ],
    ...buildSettlementReviewRows(batchNo, pendingWithdrawals)
  ]

  if (rows.length === 1) {
    res.json(failure(422, '当前项目没有可导出的医生审核记录'))
    return
  }

  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const exportBatch = exportTime.replaceAll(/[-: ]/g, '')

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="doctor-review-records-${batchNo}-${exportBatch}.csv"`
  )
  res.send(`\uFEFF${csv}`)
})

app.post('/core/product/withdrawal/export', (req, res) => {
  const batchNo = String(req.body?.batch_no || '').trim()

  if (!batchNo) {
    res.json(failure(422, '请提供要导出的项目'))
    return
  }

  const batch = buildSettlementBatches(withdrawals).find(
    (item) => item.batch_no === batchNo
  )
  if (!batch) {
    res.json(failure(404, '项目不存在或暂无结算记录，请返回列表后重试'))
    return
  }

  const pendingWithdrawals = withdrawals
    .filter(
      (withdrawal) =>
        getWithdrawalTaskBatchNo(withdrawal) === batchNo &&
        getSettlementDoctorEligibility(withdrawal).eligible &&
        withdrawal.settlement_status === 'pending'
    )
    .sort(
      (left, right) =>
        left.apply_time.localeCompare(right.apply_time) || left.id - right.id
    )

  if (pendingWithdrawals.length === 0) {
    res.json(failure(422, '当前项目暂无待导出的医生结算记录'))
    return
  }

  const exportTime = formatDateTime()
  const rows = [
    [
      '项目编号',
      '结算单号',
      '记录时间',
      '姓名',
      '手机号',
      '身份证号',
      '开户行',
      '银行卡号',
      '金额(元)',
      '结算状态',
      '审核条数'
    ],
    ...pendingWithdrawals.map((withdrawal) => {
      return [
        batchNo,
        withdrawal.withdrawal_no,
        withdrawal.apply_time,
        withdrawal.doctor_name,
        toExcelText(withdrawal.doctor_phone, /^\d{11}$/),
        toExcelText(withdrawal.id_card_no, /^\d{17}[\dXx]$/),
        withdrawal.bank_name,
        toExcelText(withdrawal.bank_card_no, /^\d{16,19}$/),
        (Number(withdrawal.amount_cent || 0) / 100).toFixed(2),
        '已导出',
        Number(withdrawal.source_review_count) || 0
      ]
    })
  ]
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const exportBatch = exportTime.replaceAll(/[-: ]/g, '')

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="foundation-settlement-${batchNo}-${exportBatch}.csv"`
  )
  res.once('finish', () => {
    pendingWithdrawals.forEach((withdrawal) => {
      withdrawal.settlement_status = 'exported'
      withdrawal.export_time = exportTime
    })
    syncWithdrawalWorkbench()
  })
  res.send(`\uFEFF${csv}`)
})

function normalizeQuestionPayload(payload = {}, currentItem = null) {
  const typeCode = String(payload.type_code || '').trim()
  const questionType = questionBankFixture.question_types.find(
    (item) => String(item.code || item.type_code) === typeCode
  )
  if (!questionType) return { error: '请选择有效的问题类型' }

  const selectedDrug = resolveDrugSelection(drugCatalogRows, payload)
  if (selectedDrug.error) return selectedDrug

  const selectedDepartment = resolveDepartmentSelection(
    buildDepartmentOptions(doctorConfigRows),
    payload.department,
    currentItem?.department
  )
  if (selectedDepartment.error) return selectedDepartment

  const textFields = { disease_type: 100 }
  const normalized = {}
  for (const [field, maxLength] of Object.entries(textFields)) {
    normalized[field] = String(payload[field] || '').trim()
    if (normalized[field].length > maxLength) {
      return { error: `${field} 不能超过 ${maxLength} 个字符` }
    }
  }

  const question = String(payload.question || '').trim()
  if (!question) return { error: '请输入审核问题' }
  if (question.length > 2000) return { error: '审核问题不能超过 2000 个字符' }

  const sourceAnswer =
    payload.answer && typeof payload.answer === 'object'
      ? payload.answer
      : { suggestion: String(payload.answer || '') }
  const answer = {
    suggestion: String(sourceAnswer.suggestion || '').trim(),
    dosage: String(sourceAnswer.dosage || '').trim(),
    precautions: (Array.isArray(sourceAnswer.precautions)
      ? sourceAnswer.precautions
      : sourceAnswer.precautions
        ? [sourceAnswer.precautions]
        : []
    )
      .map((item) => String(item || '').trim())
      .filter(Boolean),
    interaction: String(sourceAnswer.interaction || '').trim(),
    warning: String(sourceAnswer.warning || '').trim()
  }
  if (!answer.suggestion) return { error: '请输入 AI 回答' }
  if (answer.suggestion.length > 3000) return { error: 'AI 回答不能超过 3000 个字符' }
  if (
    answer.dosage.length > 2000 ||
    answer.interaction.length > 2000 ||
    answer.warning.length > 2000 ||
    answer.precautions.some((item) => item.length > 500)
  ) {
    return { error: 'AI 回答字段超过允许长度' }
  }

  const sourceReference = String(payload.source_reference || '').trim()
  if (!sourceReference) return { error: '请填写题目的说明书、指南或文献依据' }
  if (sourceReference.length > 2000) return { error: '来源依据不能超过 2000 个字符' }

  const submittedRiskTags = Array.isArray(payload.risk_tags)
    ? payload.risk_tags.map((item) => String(item).trim()).filter(Boolean)
    : []
  const unknownRiskTag = submittedRiskTags.find(
    (tag) => !Object.hasOwn(questionBankFixture.risk_tag_labels || {}, tag)
  )
  if (unknownRiskTag) return { error: '请选择有效的风险标签' }
  const defaultRiskTags = Array.isArray(questionType.default_risk_tags)
    ? questionType.default_risk_tags.map(String)
    : []
  const riskTags = [...new Set([...defaultRiskTags, ...submittedRiskTags])]
  const baseLevel = String(questionType.base_level || 'A').toUpperCase()
  const riskResult = evaluateRiskDetails(
    baseLevel,
    riskTags,
    questionBankFixture.risk_rules
  )

  return {
    data: {
      type_code: typeCode,
      type_name: questionType.name || questionType.type_name,
      ...selectedDrug.data,
      ...normalized,
      department: selectedDepartment.data,
      question,
      answer,
      risk_tags: riskTags,
      base_level: baseLevel,
      final_level: riskResult.final_level,
      upgrade_reasons: riskResult.upgrade_reasons,
      unit_reward_cent: Number(questionBankFixture.pricing[riskResult.final_level]),
      source_reference: sourceReference,
      is_deidentified: true
    }
  }
}

function serializeQuestionBankItem(item) {
  const publicItem = { ...item }
  delete publicItem.assigned_doctor_ids
  delete publicItem.assignment_count
  delete publicItem.is_deidentified
  delete publicItem.upgrade_reasons
  publicItem.risk_tag_names = resolveRiskTagNames(
    item.risk_tags,
    questionBankFixture.risk_tag_labels
  )
  publicItem.audit_log = (Array.isArray(item.audit_log) ? item.audit_log : []).map(
    (record) => ({
      ...record,
      action_label: resolveQuestionAuditActionLabel(record)
    })
  )
  return publicItem
}

app.get('/core/product/question-bank/standards', (req, res) => {
  res.json(
    success({
      pricing: questionBankFixture.pricing,
      risk_rules: questionBankFixture.risk_rules,
      risk_tag_labels: questionBankFixture.risk_tag_labels,
      question_types: questionBankFixture.question_types,
      department_options: buildDepartmentOptions(doctorConfigRows),
      summary: summarizeQuestionBank(questionBankRows)
    })
  )
})

app.get('/core/product/question-bank/drugOptions', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const rows = drugCatalogRows.filter((item) => {
    if (!keyword) return true
    return [
      item.drug_id,
      item.drug_name,
      item.drug_specification,
      item.drug_type,
      item.drug_manufacturer
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })

  res.json(success(rows))
})

app.get('/core/product/question-bank/index', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const drugId = String(req.query.drug_id || '').trim()
  const department = String(req.query.department || '').trim()
  const typeCode = String(req.query.type_code || '').trim()
  const finalLevel = String(req.query.final_level || '').trim().toUpperCase()
  const lifecycleStatus = String(req.query.lifecycle_status || '').trim()

  if (finalLevel && !['A', 'B', 'C'].includes(finalLevel)) {
    res.json(failure(422, '题目等级筛选值无效'))
    return
  }
  if (lifecycleStatus && !questionLifecycleStatuses.includes(lifecycleStatus)) {
    res.json(failure(422, '题库状态筛选值无效'))
    return
  }
  const selectedDepartment = resolveDepartmentSelection(
    buildDepartmentOptions(doctorConfigRows),
    department
  )
  if (selectedDepartment.error) {
    res.json(failure(422, selectedDepartment.error))
    return
  }
  const rows = questionBankRows
    .filter((item) => {
      if (drugId && item.drug_id !== drugId) return false
      if (department && item.department !== selectedDepartment.data) return false
      if (typeCode && item.type_code !== typeCode) return false
      if (finalLevel && item.final_level !== finalLevel) return false
      if (lifecycleStatus && item.lifecycle_status !== lifecycleStatus) return false
      if (!keyword) return true
      return [
        item.question_no,
        item.drug_id,
        item.drug_specification,
        item.question,
        item.type_name,
        item.drug_name,
        item.drug_type,
        item.drug_manufacturer,
        item.disease_type,
        item.department
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .sort((left, right) => right.id - left.id)

  res.json(success(paginate(rows.map(serializeQuestionBankItem), req.query)))
})

app.get('/core/product/question-bank/read', (req, res) => {
  const id = Number(req.query.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的题目 ID'))
    return
  }
  const item = questionBankRows.find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, '未找到对应题目'))
    return
  }
  res.json(success(serializeQuestionBankItem(item)))
})

app.post('/core/product/question-bank/save', (req, res) => {
  const normalized = normalizeQuestionPayload(req.body)
  if (normalized.error) {
    res.json(failure(422, normalized.error))
    return
  }

  const now = formatDateTime()
  const item = {
    id: nextQuestionId,
    question_no: `QB-${normalized.data.type_code}-${String(nextQuestionId).padStart(4, '0')}`,
    ...normalized.data,
    lifecycle_status: 'draft',
    assignment_count: 0,
    assigned_doctor_ids: [],
    audit_log: [
      {
        action: 'created',
        action_label: '创建题目草稿',
        operator: '运营管理员',
        create_time: now
      }
    ],
    create_time: now,
    update_time: now
  }
  nextQuestionId += 1
  questionBankRows.push(item)
  res.json(success(serializeQuestionBankItem(item), '题目已新增，确认后可设为可分配'))
})

app.put('/core/product/question-bank/update', (req, res) => {
  const id = Number(req.query.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的题目 ID'))
    return
  }
  const item = questionBankRows.find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, '未找到对应题目'))
    return
  }
  const normalized = normalizeQuestionPayload(req.body, item)
  if (normalized.error) {
    res.json(failure(422, normalized.error))
    return
  }
  const now = formatDateTime()
  Object.assign(item, normalized.data, {
    update_time: now,
    audit_log: [
      ...(Array.isArray(item.audit_log) ? item.audit_log : []),
      {
        action: 'updated',
        action_label: '更新题目内容',
        operator: '运营管理员',
        create_time: now
      }
    ]
  })
  res.json(success(serializeQuestionBankItem(item), '题目已保存'))
})

app.post('/core/product/question-bank/changeStatus', (req, res) => {
  const id = Number(req.body?.id)
  const status = String(req.body?.status || req.body?.lifecycle_status || '').trim()
  if (!Number.isInteger(id) || id <= 0) {
    res.json(failure(422, '请提供有效的题目 ID'))
    return
  }
  if (!['available', 'disabled'].includes(status)) {
    res.json(failure(422, '题库状态值无效'))
    return
  }
  const item = questionBankRows.find((row) => row.id === id)
  if (!item) {
    res.json(failure(404, '未找到对应题目'))
    return
  }
  if (status === 'available' && item.is_deidentified !== true) {
    res.json(failure(422, '题目安全校验未通过，不能设为可分配'))
    return
  }

  const now = formatDateTime()
  item.lifecycle_status = status
  item.update_time = now
  item.audit_log = [
    ...(Array.isArray(item.audit_log) ? item.audit_log : []),
    {
      action: status === 'available' ? 'enabled' : 'disabled',
      action_label: status === 'available' ? '设为可分配' : '停用题目',
      operator: '运营管理员',
      create_time: now
    }
  ]
  res.json(
    success(
      serializeQuestionBankItem(item),
      status === 'available' ? '题目已设为可分配' : '题目已停用'
    )
  )
})

app.get('/core/product/task/batches', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const sourceType =
    req.query.source_type === 'all' ? '' : String(req.query.source_type || '').trim()
  const allowedSourceTypes = ['manual', 'import']

  if (sourceType && !allowedSourceTypes.includes(sourceType)) {
    res.json(failure(422, '项目来源筛选值无效'))
    return
  }

  const filteredBatches = buildTaskBatches().filter((batch) => {
    if (sourceType && batch.source_type !== sourceType) return false
    if (!keyword) return true
    return [
      batch.batch_no,
      batch.display_title,
      batch.foundation_name,
      batch.project_name,
      batch.identifier_name
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })

  res.json(success(paginate(filteredBatches, req.query)))
})

app.get('/core/product/task/batches/read', (req, res) => {
  const batch = findTaskBatch(req.query.batch_key)
  if (!batch) {
    res.json(failure(404, '未找到对应项目'))
    return
  }
  res.json(success(batch))
})

app.get('/core/product/task/batches/progress', (req, res) => {
  const batch = findTaskBatch(req.query.batch_key)
  if (!batch) {
    res.json(failure(404, '未找到对应项目'))
    return
  }

  const statusLabels = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已完成'
  }
  const rows = [
    [
      '项目编号',
      '基金会名称',
      '项目名称',
      '项目标识',
      '医生姓名',
      '手机号',
      '医院',
      '科室',
      '项目数',
      '项目题数',
      '已完成题数',
      '完成进度',
      '项目状态',
      '账号状态',
      '最近项目时间'
    ]
  ]
  const accountStatusLabels = {
    active: '已激活',
    pending_activation: '待激活',
    disabled: '已禁用'
  }
  batch.doctors.forEach((doctor) => {
    rows.push([
      batch.batch_no,
      doctor.foundation_name || batch.foundation_name || '',
      doctor.project_name || batch.project_name || '',
      doctor.identifier_name || batch.identifier_name || '',
      doctor.doctor_name,
      toExcelText(doctor.doctor_phone, /^\d{11}$/),
      doctor.hospital,
      doctor.department,
      doctor.task_count,
      doctor.item_count,
      doctor.completed_count,
      `${doctor.progress_percent}%`,
      statusLabels[doctor.status] || doctor.status || '',
      accountStatusLabels[doctor.account_status] || doctor.account_status || '',
      doctor.create_time || ''
    ])
  })

  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const safeBatchNo = String(batch.batch_no || 'batch').replace(/[^a-zA-Z0-9_-]/g, '_')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="task-batch-progress-${safeBatchNo}.csv"`
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
    res.json(failure(422, '项目状态筛选值无效'))
    return
  }

  if (sourceType && !allowedSourceTypes.includes(sourceType)) {
    res.json(failure(422, '项目来源筛选值无效'))
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
        task.import_batch_no,
        task.foundation_name,
        task.project_name,
        task.identifier_name
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
    res.json(failure(422, '请提供有效的项目 ID'))
    return
  }

  const task = tasks.find((item) => item.id === id)

  if (!task) {
    res.json(failure(404, '未找到对应项目'))
    return
  }

  res.json(success(hydrateTask(task, { includeItems: true })))
})

app.get('/core/product/task/doctorOptions', (req, res) => {
  const options = doctors
    .map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      phone: doctor.phone,
      hospital: doctor.hospital,
      department: doctor.department,
      title: doctor.title,
      account_status: doctor.account_status,
      training_exam_status: doctor.training_exam_status,
      max_review_level: doctor.max_review_level
    }))
    .sort((left, right) => left.id - right.id)

  res.json(success(options))
})

app.get('/core/product/task/orgOptions', (req, res) => {
  res.json(success(buildTaskOrgOptions()))
})

app.post('/core/product/task/save', (req, res) => {
  const doctorId = Number(req.body?.doctor_id)
  const targetPoints = Number(req.body?.target_points)

  if (!Number.isInteger(doctorId) || doctorId <= 0) {
    res.json(failure(422, '请选择要分配项目的医生'))
    return
  }

  const pointsValidation = validateTargetPoints(targetPoints)
  if (pointsValidation.error) {
    res.json(failure(422, pointsValidation.error))
    return
  }

  const identifierId = Number(req.body?.identifier_id)
  if (!Number.isInteger(identifierId) || identifierId <= 0) {
    res.json(failure(422, '请选择项目标识'))
    return
  }

  const orgChain = resolveTaskOrgChain(identifierId)
  if (!orgChain) {
    res.json(failure(404, '所选项目标识不存在，请刷新后重新选择'))
    return
  }

  if (
    Number(req.body?.project_id) !== orgChain.project.id ||
    Number(req.body?.foundation_id) !== orgChain.foundation.id
  ) {
    res.json(failure(422, '基金会、项目和项目标识不匹配，请重新选择'))
    return
  }

  const orgDisabledError = taskOrgDisabledError(orgChain)
  if (orgDisabledError) {
    res.json(failure(422, orgDisabledError))
    return
  }

  const doctor = doctors.find((item) => item.id === doctorId)

  if (!doctor) {
    res.json(failure(404, '未找到对应医生，请刷新后重新选择'))
    return
  }

  if (doctor.account_status === 'disabled') {
    res.json(failure(422, '该医生账号已禁用，无法创建新项目'))
    return
  }

  const eligibilityError = doctorReviewEligibilityError(doctor)
  if (eligibilityError) {
    res.json(failure(422, eligibilityError))
    return
  }

  const plan = planTaskQuestions(
    questionBankRows,
    targetPoints,
    doctor,
    `manual|${doctor.id}|${Date.now()}`
  )
  if (!plan.success) {
    res.json(failure(422, plan.reason))
    return
  }

  const task = createTask(doctor, plan, 'manual', null, null, orgChain)
  tasks.push(task)
  updateWorkbench(task.item_count, 0)
  res.json(success(hydrateTask(task), '项目已创建'))
})

app.post('/core/product/task/importPreview', async (req, res) => {
  try {
    const fileName = String(req.body?.file_name || '').trim()
    const parsed = await readTaskImportRows(req.body)
    if (parsed.error) {
      res.json(failure(422, parsed.error))
      return
    }

    const previewToken = `PV${Date.now()}${String(
      Math.floor(Math.random() * 1000)
    ).padStart(3, '0')}`
    const seed = `${previewToken}|${fileName}`
    const analysis = analyzeTaskImportRows(parsed.rows, fileName, seed)
    if (analysis.error) {
      res.json(failure(422, analysis.error))
      return
    }

    importPreviews.set(previewToken, {
      file_name: fileName,
      source_rows: parsed.rows,
      seed,
      rows: analysis.rows,
      summary: analysis.summary
    })

    res.json(
      success({
        preview_token: previewToken,
        preview_id: previewToken,
        file_name: fileName,
        summary: analysis.summary,
        rows: analysis.rows
      })
    )
  } catch (error) {
    console.error(error)
    res.json(failure(500, '名单解析失败，请稍后重试'))
  }
})

app.post('/core/product/task/importConfirm', (req, res) => {
  const previewId = String(req.body?.preview_token || req.body?.preview_id || '').trim()

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

  const currentAnalysis = analyzeTaskImportRows(
    preview.source_rows,
    preview.file_name,
    preview.seed
  )
  if (currentAnalysis.error) {
    res.json(failure(422, currentAnalysis.error))
    return
  }
  if (currentAnalysis.summary.error_rows > 0) {
    const firstInvalid = currentAnalysis.rows.find(
      (row) => row.validation_status === 'invalid'
    )
    res.json(
      failure(
        422,
        `题库库存或账号信息已变化：${firstInvalid?.validation_message || '请重新校验名单'}`
      )
    )
    return
  }

  const batchNo = `DR${formatDateTime().slice(0, 10).replaceAll('-', '')}${String(
    Date.now()
  ).slice(-5)}`
  const createdTasks = []
  let newDoctorCount = 0

  currentAnalysis.rows.forEach((row) => {
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
        gender: null,
        account_status: 'pending_activation',
        certification_status: 'unsubmitted',
        training_exam_status: 'passed',
        max_review_level: 'C',
        review_qualification_source: 'admin_import_roster',
        account_source: 'import',
        create_time: createTime,
        activation_time: null,
        last_login_time: null
      }
      nextDoctorId += 1
      newDoctorCount += 1
      doctors.push(doctor)
    }

    const selectedQuestions = row.question_ids.map((questionId) =>
      questionBankRows.find((question) => question.id === questionId)
    )
    const plan = {
      target_points: row.target_points,
      total_reward_cent: row.total_reward_cent,
      rows: selectedQuestions,
      level_summary: row.level_summary,
      matched_item_count: row.matched_item_count
    }
    const task = createTask(
      doctor,
      plan,
      'import',
      batchNo,
      row.create_date,
      row.identifier_id ? resolveTaskOrgChain(row.identifier_id) : null
    )
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
        matched_item_count: totalItemCount,
        total_target_points: currentAnalysis.summary.total_target_points,
        total_reward_cent: currentAnalysis.summary.total_reward_cent,
        level_summary: currentAnalysis.summary.level_summary
      },
      '名单导入成功，账号和项目已自动创建'
    )
  )
})

app.get('/core/product/task/template', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('名单')
    worksheet.addRow([
      '基金会名称',
      '项目名称',
      '项目标识',
      '医生姓名',
      '手机号',
      '项目积分',
      '创建日期'
    ])
    worksheet.addRow([
      '中国人权发展基金会',
      '希息药事审核项目',
      '医生端小程序',
      '示例医生',
      '13800000000',
      10000,
      '2026-08-05'
    ])
    worksheet.columns = [
      { width: 26 },
      { width: 22 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 14 },
      { width: 16 }
    ]
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F3FF' }
    }
    worksheet.getColumn(5).numFmt = '@'
    const buffer = await workbook.xlsx.writeBuffer()
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="doctor-task-import-template.xlsx"'
    )
    res.send(Buffer.from(buffer))
  } catch (error) {
    console.error(error)
    res.status(500).json(failure(500, '导入模板生成失败'))
  }
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
