const LEVELS = ['A', 'B', 'C']

export const UNIT_REWARD_CENT = {
  A: 10000,
  B: 20000,
  C: 30000
}

export const DEFAULT_DRUG_MANUFACTURERS = [
  '华润双鹤药业股份有限公司',
  '石药集团欧意药业有限公司',
  '齐鲁制药有限公司',
  '扬子江药业集团有限公司',
  '江苏恒瑞医药股份有限公司',
  '浙江京新药业股份有限公司',
  '东北制药集团沈阳第一制药有限公司',
  '上海信谊药厂有限公司',
  '北京福元医药股份有限公司',
  '山东新华制药股份有限公司',
  '广州白云山医药集团股份有限公司白云山制药总厂',
  '国药集团工业有限公司',
  '四川科伦药业股份有限公司',
  '湖南迪诺制药股份有限公司',
  '成都倍特药业股份有限公司',
  '重庆药友制药有限责任公司',
  '珠海联邦制药股份有限公司中山分公司',
  '哈药集团制药六厂',
  '仁和堂药业有限公司',
  '山西振东安特生物制药有限公司'
]

export const QUESTION_AUDIT_ACTION_LABELS = {
  created: '创建题目',
  updated: '更新题目内容',
  enabled: '设为可分配',
  disabled: '停用题目',
  status_changed: '变更题目状态'
}

function normalizeLevel(value, fieldName = 'level') {
  const level = String(value || '').trim().toUpperCase()
  if (!LEVELS.includes(level)) {
    throw new Error(`${fieldName} must be one of A, B or C`)
  }
  return level
}

function cloneValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

export function resolveRiskTagNames(riskTags, riskTagLabels = {}) {
  return (Array.isArray(riskTags) ? riskTags : []).map((tag) => {
    const label = String(riskTagLabels?.[tag] || '').trim()
    return label && !/[A-Za-z]/.test(label) ? label : '其他风险标签'
  })
}

export function resolveQuestionAuditActionLabel(record = {}) {
  const existingLabel = String(record.action_label || '').trim()
  if (existingLabel && !/[A-Za-z]/.test(existingLabel)) return existingLabel
  return QUESTION_AUDIT_ACTION_LABELS[record.action] || '题目操作'
}

export function createDrugPlaceholderImage(drugName, seed = 0) {
  const palettes = [
    ['#E8F3FF', '#165DFF'],
    ['#E8FFFB', '#00B42A'],
    ['#FFF7E8', '#FF7D00'],
    ['#F5E8FF', '#722ED1'],
    ['#FFECE8', '#F53F3F']
  ]
  const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) : 0
  const [background, foreground] = palettes[Math.abs(numericSeed) % palettes.length]
  const label = (String(drugName || '药品').trim().slice(0, 2) || '药品')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="${background}"/><path d="M28 54a12 12 0 0 1 0-17l9-9a12 12 0 0 1 17 17l-9 9a12 12 0 0 1-17 0Z" fill="${foreground}" opacity=".2"/><path d="m33 49 16-16" stroke="${foreground}" stroke-width="6" stroke-linecap="round"/><text x="48" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="${foreground}">${label}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function buildDrugCatalog(fixture, copiesPerType = 100) {
  const templates = fixture?.drug_templates
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error('fixture.drug_templates must be a non-empty array')
  }

  const configuredManufacturers = Array.isArray(fixture?.drug_manufacturers)
    ? fixture.drug_manufacturers.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const manufacturers =
    configuredManufacturers.length > 0
      ? configuredManufacturers
      : DEFAULT_DRUG_MANUFACTURERS

  return Array.from({ length: copiesPerType }, (_, copyIndex) => {
    const template = templates[copyIndex % templates.length]
    const drugName = String(template.name || template.drug_name || '').trim()
    const specifications = Array.isArray(template.specifications)
      ? template.specifications.map((item) => String(item || '').trim()).filter(Boolean)
      : []
    const variantIndex = Math.floor(copyIndex / templates.length)
    const drugSpecification = specifications[variantIndex % specifications.length]

    if (!drugName || !drugSpecification) {
      throw new Error(
        `fixture.drug_templates[${copyIndex % templates.length}] requires name and specifications`
      )
    }

    return {
      drug_id: `DRUG-${String(copyIndex + 1).padStart(3, '0')}`,
      drug_image_url:
        String(template.drug_image_url || '').trim() ||
        createDrugPlaceholderImage(drugName, copyIndex),
      drug_name: drugName,
      drug_specification: drugSpecification,
      drug_type: String(template.drug_type || '').trim(),
      drug_manufacturer:
        String(template.drug_manufacturer || '').trim() ||
        manufacturers[copyIndex % manufacturers.length]
    }
  })
}

export function buildDepartmentOptions(doctorConfigRows) {
  const seenValues = new Set()
  return (Array.isArray(doctorConfigRows) ? doctorConfigRows : [])
    .filter(
      (item) =>
        item.type === 'department' &&
        ['1', 'enabled'].includes(String(item.status || '').trim().toLowerCase())
    )
    .sort(
      (left, right) =>
        Number(left.sort) - Number(right.sort) || Number(left.id) - Number(right.id)
    )
    .flatMap((item) => {
      const value = String(item.name || '').trim()
      const normalizedValue = value.toLowerCase()
      if (!value || seenValues.has(normalizedValue)) return []
      seenValues.add(normalizedValue)
      return [{ label: value, value }]
    })
}

export function resolveDepartmentSelection(departmentOptions, value, currentValue = null) {
  const department = String(value || '').trim()
  if (!department) return { data: '' }

  const existingDepartment = String(currentValue || '').trim()
  if (existingDepartment && department === existingDepartment) {
    return { data: existingDepartment }
  }

  const matched = (Array.isArray(departmentOptions) ? departmentOptions : []).find(
    (item) => String(item.value || '').trim() === department
  )
  if (!matched) {
    return { error: '科室归属必须选择医院端配置中已启用的科室' }
  }

  return { data: matched.value }
}

export function resolveDrugSelection(drugCatalog, payload = {}) {
  const drugId = String(payload.drug_id || '').trim()
  if (!drugId) return { error: '请从 AI 数智人药师药品库选择药品' }

  const drug = (Array.isArray(drugCatalog) ? drugCatalog : []).find(
    (item) => String(item.drug_id) === drugId
  )
  if (!drug) return { error: '所选药品不在 AI 数智人药师药品库中，请重新检索选择' }

  const protectedFields = [
    'drug_image_url',
    'drug_name',
    'drug_specification',
    'drug_type',
    'drug_manufacturer'
  ]
  const hasOverride = protectedFields.some((field) => {
    if (payload[field] === undefined || payload[field] === null) return false
    return String(payload[field]).trim() !== String(drug[field] || '').trim()
  })
  if (hasOverride) {
    return { error: '药品图片、名称、规格、类型和厂家由药品库提供，不能手动覆盖' }
  }

  return {
    data: {
      drug_id: drug.drug_id,
      drug_image_url: drug.drug_image_url,
      drug_name: drug.drug_name,
      drug_specification: drug.drug_specification,
      drug_type: drug.drug_type,
      drug_manufacturer: drug.drug_manufacturer
    }
  }
}

function normalizeRiskRules(riskRules = []) {
  if (Array.isArray(riskRules)) {
    return riskRules.flatMap((rule, index) => {
      const tags = rule.tags || rule.risk_tags || rule.tag || rule.risk_tag || []
      const targetLevel =
        rule.upgrade_to ||
        rule.target_level ||
        rule.min_level ||
        rule.final_level ||
        rule.level

      const normalizedTags = (Array.isArray(tags) ? tags : [tags]).map(String)
      const tagLevels = rule.tag_levels || {}
      const specialRules = Object.entries(tagLevels).map(([tag, level]) => ({
        tags: [String(tag)],
        target_level: normalizeLevel(level, `riskRules[${index}].tag_levels.${tag}`),
        reason: String(rule.reason || rule.description || rule.name || '').trim()
      }))
      const defaultTags = normalizedTags.filter((tag) => !(tag in tagLevels))
      const defaultRule = {
        tags: defaultTags,
        target_level: normalizeLevel(targetLevel, `riskRules[${index}].target_level`),
        reason: String(rule.reason || rule.description || rule.name || '').trim()
      }

      return defaultTags.length > 0 ? [defaultRule, ...specialRules] : specialRules
    })
  }

  if (riskRules && Array.isArray(riskRules.rules)) {
    return normalizeRiskRules(riskRules.rules)
  }

  if (riskRules && typeof riskRules === 'object') {
    return Object.entries(riskRules).map(([tag, value], index) => {
      const rule = typeof value === 'string' ? { level: value } : value || {}
      return {
        tags: [String(tag)],
        target_level: normalizeLevel(
          rule.upgrade_to || rule.target_level || rule.min_level || rule.level,
          `riskRules[${index}].target_level`
        ),
        reason: String(rule.reason || rule.description || rule.name || '').trim()
      }
    })
  }

  return []
}

function evaluateRisk(baseLevel, riskTags = [], riskRules = []) {
  let finalLevel = normalizeLevel(baseLevel, 'baseLevel')
  const tagSet = new Set((Array.isArray(riskTags) ? riskTags : []).map(String))
  const reasons = []

  normalizeRiskRules(riskRules).forEach((rule) => {
    const matchedTags = rule.tags.filter((tag) => tagSet.has(tag))
    if (matchedTags.length === 0) return

    if (LEVELS.indexOf(rule.target_level) > LEVELS.indexOf(finalLevel)) {
      const previousLevel = finalLevel
      finalLevel = rule.target_level
      reasons.push(
        rule.reason ||
          `${matchedTags.join('、')}：风险等级由 ${previousLevel} 升级为 ${finalLevel}`
      )
    }
  })

  return { finalLevel, reasons }
}

export function evaluateRiskLevel(baseLevel, riskTags, riskRules) {
  return evaluateRisk(baseLevel, riskTags, riskRules).finalLevel
}

export function evaluateRiskDetails(baseLevel, riskTags, riskRules) {
  const result = evaluateRisk(baseLevel, riskTags, riskRules)
  return {
    final_level: result.finalLevel,
    upgrade_reasons: [...result.reasons]
  }
}

function renderTemplate(value, context) {
  if (Array.isArray(value)) {
    return value.map((item) => renderTemplate(item, context))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renderTemplate(item, context)])
    )
  }

  if (typeof value !== 'string') return value

  return value
    .replaceAll('{{index}}', context.index)
    .replaceAll('{{type_code}}', context.type_code)
    .replaceAll('{{type_name}}', context.type_name)
    .replaceAll('{{drug_name}}', context.drug_name)
    .replaceAll('{{drug_specification}}', context.drug_specification)
    .replaceAll('{index}', context.index)
    .replaceAll('{type_code}', context.type_code)
    .replaceAll('{type_name}', context.type_name)
    .replaceAll('{drug_name}', context.drug_name)
    .replaceAll('{drug_specification}', context.drug_specification)
}

function pickTemplate(questionType, field, copyIndex) {
  const templates = questionType[`${field}_templates`]
  if (Array.isArray(templates) && templates.length > 0) {
    return templates[copyIndex % templates.length]
  }

  return questionType[field] ?? questionType[`${field}_template`]
}

export function buildQuestionBank(fixture, { copiesPerType = 100 } = {}) {
  const questionTypes = fixture?.question_types
  if (!Array.isArray(questionTypes) || questionTypes.length === 0) {
    throw new Error('fixture.question_types must be a non-empty array')
  }

  if (!Number.isInteger(copiesPerType) || copiesPerType <= 0) {
    throw new Error('copiesPerType must be a positive integer')
  }

  const riskRules = fixture.risk_rules || []
  const defaultTime =
    fixture.generated_at || fixture.create_time || '2026-08-05 00:00:00'
  const sequenceWidth = Math.max(3, String(copiesPerType).length)
  const drugCatalog = buildDrugCatalog(fixture, copiesPerType)
  const rows = []

  questionTypes.forEach((questionType, typeIndex) => {
    const typeCode = String(
      questionType.type_code || questionType.code || `QT${String(typeIndex + 1).padStart(2, '0')}`
    ).trim()
    const typeName = String(
      questionType.type_name || questionType.name || `审核题型 ${typeIndex + 1}`
    ).trim()
    const baseLevel = normalizeLevel(
      questionType.base_level || questionType.level || 'A',
      `question_types[${typeIndex}].base_level`
    )
    const configuredRiskTags = questionType.risk_tags || questionType.default_risk_tags
    const riskTags = Array.isArray(configuredRiskTags)
      ? configuredRiskTags.map(String)
      : []
    const { finalLevel, reasons } = evaluateRisk(baseLevel, riskTags, riskRules)
    const createTime = questionType.create_time || defaultTime

    for (let copyIndex = 0; copyIndex < copiesPerType; copyIndex += 1) {
      const sequence = String(copyIndex + 1).padStart(sequenceWidth, '0')
      const drug = drugCatalog[copyIndex]
      const drugTemplate = fixture.drug_templates[copyIndex % fixture.drug_templates.length]
      const context = {
        index: sequence,
        type_code: typeCode,
        type_name: typeName,
        drug_name: drug.drug_name,
        drug_specification: drug.drug_specification
      }
      const questionTemplate =
        pickTemplate(questionType, 'question', copyIndex) ?? questionType.typical_question
      const answerTemplate =
        pickTemplate(questionType, 'answer', copyIndex) ?? questionType.review_focus
      const id = rows.length + 1

      rows.push({
        id,
        question_no: `QB-${typeCode}-${sequence}`,
        ...drug,
        disease_type: String(questionType.disease_type || '').trim(),
        department: String(
          questionType.department || drugTemplate.default_department || ''
        ).trim(),
        type_code: typeCode,
        type_name: typeName,
        base_level: baseLevel,
        final_level: finalLevel,
        upgrade_reasons: [...reasons],
        risk_tags: [...riskTags],
        unit_reward_cent: UNIT_REWARD_CENT[finalLevel],
        question: renderTemplate(
          questionTemplate ?? `${typeName}审核示例问题（${sequence}）`,
          context
        ),
        answer: renderTemplate(
          answerTemplate ?? `请依据权威药品资料审核该${typeName}问题。`,
          context
        ),
        source_reference: cloneValue(
          questionType.source_reference ??
            fixture.source_reference ??
            '药品说明书、权威药学数据库及现行临床指南（模拟题库）'
        ),
        is_deidentified: true,
        lifecycle_status: questionType.lifecycle_status || 'available',
        assignment_count: 0,
        assigned_doctor_ids: [],
        audit_log: cloneValue(questionType.audit_log) || [
          {
            action: 'created',
            action_label: '创建题目',
            operator: '系统初始化',
            create_time: createTime
          }
        ],
        create_time: createTime,
        update_time: questionType.update_time || createTime
      })
    }
  })

  return rows
}

function hashString(value) {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function emptyLevelSummary() {
  return { A: 0, B: 0, C: 0 }
}

export function planQuestionAllocation(
  questionRows,
  targetPoints,
  { maxLevel = 'C', seed = '', doctorId = null } = {}
) {
  const allowedMaxLevel = normalizeLevel(maxLevel, 'maxLevel')
  const target = Number(targetPoints)
  const maxLevelIndex = LEVELS.indexOf(allowedMaxLevel)
  const normalizedDoctorId =
    doctorId === null || doctorId === undefined ? '' : String(doctorId)
  const seenQuestionKeys = new Set()
  const candidates = (Array.isArray(questionRows) ? questionRows : [])
    .filter((row, index) => {
      const level = String(row.final_level || row.base_level || '').toUpperCase()
      const questionKey = String(row.id ?? row.question_no ?? `row-${index}`)
      const assignedDoctorIds = Array.isArray(row.assigned_doctor_ids)
        ? row.assigned_doctor_ids.map(String)
        : []
      const eligible =
        row.lifecycle_status === 'available' &&
        LEVELS.includes(level) &&
        LEVELS.indexOf(level) <= maxLevelIndex &&
        Number(row.unit_reward_cent) === UNIT_REWARD_CENT[level] &&
        (!normalizedDoctorId || !assignedDoctorIds.includes(normalizedDoctorId))

      if (!eligible || seenQuestionKeys.has(questionKey)) return false
      seenQuestionKeys.add(questionKey)
      return true
    })
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((left, right) => {
      const leftKey = `${seed}|${left.row.question_no || left.row.id || left.originalIndex}`
      const rightKey = `${seed}|${right.row.question_no || right.row.id || right.originalIndex}`
      return (
        hashString(leftKey) - hashString(rightKey) ||
        String(left.row.question_no || left.row.id).localeCompare(
          String(right.row.question_no || right.row.id)
        )
      )
    })
  const availablePoints = candidates.reduce(
    (total, candidate) => total + Number(candidate.row.unit_reward_cent),
    0
  )
  const failure = (reason) => ({
    success: false,
    reason,
    target_points: target,
    available_points: availablePoints,
    rows: [],
    level_summary: emptyLevelSummary()
  })

  if (!Number.isInteger(target) || target < 0) {
    return failure('目标积分必须是非负整数')
  }

  if (target % UNIT_REWARD_CENT.A !== 0) {
    return failure('目标积分必须是 10000 的整数倍')
  }

  if (target > availablePoints) {
    return failure(`可用题目积分不足：目标 ${target}，当前可用 ${availablePoints}`)
  }

  if (target === 0) {
    return {
      success: true,
      reason: '',
      target_points: 0,
      allocated_points: 0,
      available_points: availablePoints,
      rows: [],
      level_summary: emptyLevelSummary()
    }
  }

  const unit = UNIT_REWARD_CENT.A
  const targetUnits = target / unit
  const reachable = Array(targetUnits + 1).fill(false)
  const previous = Array(targetUnits + 1).fill(null)
  reachable[0] = true

  candidates.forEach((candidate, candidateIndex) => {
    const value = Number(candidate.row.unit_reward_cent) / unit
    for (let sum = targetUnits; sum >= value; sum -= 1) {
      if (!reachable[sum] && reachable[sum - value]) {
        reachable[sum] = true
        previous[sum] = { previousSum: sum - value, candidateIndex }
      }
    }
  })

  if (!reachable[targetUnits]) {
    return failure(
      `当前可用题目无法精确匹配目标积分 ${target}，可用积分合计 ${availablePoints}`
    )
  }

  const selected = []
  let remaining = targetUnits
  while (remaining > 0) {
    const step = previous[remaining]
    selected.push(candidates[step.candidateIndex].row)
    remaining = step.previousSum
  }

  const levelSummary = selected.reduce((summary, row) => {
    summary[row.final_level] += 1
    return summary
  }, emptyLevelSummary())

  return {
    success: true,
    reason: '',
    target_points: target,
    allocated_points: target,
    available_points: availablePoints,
    rows: selected,
    level_summary: levelSummary
  }
}

export function recordQuestionAllocation(questionRows, selectedRows, doctorId) {
  if (doctorId === null || doctorId === undefined || String(doctorId).trim() === '') {
    throw new Error('doctorId is required')
  }

  const normalizedDoctorId = String(doctorId)
  const selectedIds = new Set(
    (Array.isArray(selectedRows) ? selectedRows : []).map((row) => String(row.id))
  )

  ;(Array.isArray(questionRows) ? questionRows : []).forEach((row) => {
    if (!selectedIds.has(String(row.id))) return
    const assignedDoctorIds = new Map(
      (Array.isArray(row.assigned_doctor_ids) ? row.assigned_doctor_ids : []).map(
        (id) => [String(id), id]
      )
    )
    assignedDoctorIds.set(normalizedDoctorId, doctorId)
    row.assigned_doctor_ids = [...assignedDoctorIds.values()]
    row.assignment_count = row.assigned_doctor_ids.length
  })
}

export function summarizeQuestionBank(rows) {
  const drugIds = new Set()
  const summary = {
    total_count: 0,
    drug_count: 0,
    available_count: 0,
    unavailable_count: 0,
    assignment_total: 0
  }

  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    if (row.drug_id) drugIds.add(String(row.drug_id))

    summary.total_count += 1
    if (row.lifecycle_status === 'available') summary.available_count += 1
    else summary.unavailable_count += 1
    summary.assignment_total += Number(row.assignment_count) || 0
  })

  summary.drug_count = drugIds.size

  return summary
}
