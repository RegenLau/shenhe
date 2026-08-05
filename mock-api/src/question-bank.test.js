import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
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

const fixturePath = fileURLToPath(
  new URL('../data/question-bank.json', import.meta.url)
)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const doctorConfigPath = fileURLToPath(
  new URL('../data/doctor-config.json', import.meta.url)
)
const doctorConfigRows = JSON.parse(readFileSync(doctorConfigPath, 'utf8'))

test('V5.0 题型数量与分级定价完整', () => {
  assert.equal(fixture.question_types.length, 36)
  assert.deepEqual(
    fixture.question_types.reduce(
      (summary, item) => ({ ...summary, [item.base_level]: summary[item.base_level] + 1 }),
      { A: 0, B: 0, C: 0 }
    ),
    { A: 15, B: 12, C: 9 }
  )
  assert.deepEqual(fixture.pricing, { A: 10000, B: 20000, C: 30000 })

  const rows = buildQuestionBank(fixture)
  const enabledDepartments = new Set(
    buildDepartmentOptions(doctorConfigRows).map((item) => item.value)
  )
  assert.equal(rows.length, 3600)
  assert.equal(new Set(rows.map((item) => item.question_no)).size, rows.length)
  assert.ok(rows.every((item) => item.is_deidentified === true))
  assert.ok(rows.every((item) => !Object.hasOwn(item, 'version')))
  assert.ok(rows.every((item) => !Object.hasOwn(item, 'assignment_status')))
  assert.ok(rows.every((item) => !Object.hasOwn(item, 'assigned_task_id')))
  assert.ok(rows.every((item) => enabledDepartments.has(item.department)))
  assert.deepEqual(new Set(rows.map((item) => item.department)), enabledDepartments)
  assert.ok(
    rows.every(
      (item) =>
        item.drug_id &&
        item.drug_image_url.startsWith('data:image/svg+xml') &&
        item.drug_name &&
        item.drug_specification &&
        item.drug_manufacturer
    )
  )

  const rowsByDrug = rows.reduce((groups, item) => {
    const drugRows = groups.get(item.drug_id) || []
    drugRows.push(item)
    groups.set(item.drug_id, drugRows)
    return groups
  }, new Map())
  assert.equal(rowsByDrug.size, 100)
  assert.equal(
    new Set(
      [...rowsByDrug.values()].map(
        ([item]) => `${item.drug_name}|${item.drug_specification}`
      )
    ).size,
    100
  )
  rowsByDrug.forEach((drugRows) => {
    assert.equal(drugRows.length, 36)
    assert.equal(new Set(drugRows.map((item) => item.drug_name)).size, 1)
    assert.equal(new Set(drugRows.map((item) => item.drug_specification)).size, 1)
    assert.deepEqual(
      drugRows.reduce(
        (summary, item) => ({
          ...summary,
          [item.base_level]: summary[item.base_level] + 1
        }),
        { A: 0, B: 0, C: 0 }
      ),
      { A: 15, B: 12, C: 9 }
    )
  })

  assert.deepEqual(summarizeQuestionBank(rows), {
    total_count: 3600,
    drug_count: 100,
    available_count: 3600,
    unavailable_count: 0,
    assignment_total: 0
  })
})

test('风险规则只升不降，高警示药与儿童精确剂量升为 C 级', () => {
  const highAlert = evaluateRiskDetails('A', ['high_alert_medication'], fixture.risk_rules)
  const pediatric = evaluateRiskDetails('A', ['pediatric_exact_dose'], fixture.risk_rules)
  const conflict = evaluateRiskDetails('A', ['prescription_label_conflict'], fixture.risk_rules)
  const unchanged = evaluateRiskDetails('C', ['drug_recommendation'], fixture.risk_rules)

  assert.equal(highAlert.final_level, 'C')
  assert.equal(pediatric.final_level, 'C')
  assert.equal(conflict.final_level, 'B')
  assert.equal(unchanged.final_level, 'C')
  assert.ok(highAlert.upgrade_reasons.length > 0)
})

test('风险标签和操作记录都提供中文展示值', () => {
  const knownRiskTags = new Set()
  fixture.risk_rules.forEach((rule) => {
    ;(rule.tags || []).forEach((tag) => knownRiskTags.add(tag))
    Object.keys(rule.tag_levels || {}).forEach((tag) => knownRiskTags.add(tag))
  })
  fixture.question_types.forEach((questionType) => {
    ;(questionType.default_risk_tags || []).forEach((tag) => knownRiskTags.add(tag))
  })

  assert.deepEqual(new Set(Object.keys(fixture.risk_tag_labels)), knownRiskTags)
  assert.ok(
    Object.values(fixture.risk_tag_labels).every(
      (label) => String(label).trim() && !/[A-Za-z]/.test(label)
    )
  )

  const rows = buildQuestionBank(fixture)
  rows.forEach((row) => {
    const names = resolveRiskTagNames(row.risk_tags, fixture.risk_tag_labels)
    assert.equal(names.length, row.risk_tags.length)
    assert.ok(names.every((name) => name && !/[A-Za-z]/.test(name)))
    assert.ok(
      row.audit_log.every(
        (record) => record.action_label && !/[A-Za-z]/.test(record.action_label)
      )
    )
  })
  assert.deepEqual(resolveRiskTagNames(['unknown_tag'], fixture.risk_tag_labels), [
    '其他风险标签'
  ])
  ;['created', 'updated', 'enabled', 'disabled', 'status_changed', 'unknown'].forEach(
    (action) => {
      const label = resolveQuestionAuditActionLabel({ action })
      assert.ok(label && !/[A-Za-z]/.test(label))
    }
  )
  assert.equal(
    resolveQuestionAuditActionLabel({ action: 'updated', action_label: 'updated' }),
    '更新题目内容'
  )
})

test('同一题可分配给不同医生，同一医生不会再拿到该题', () => {
  const rows = buildQuestionBank(fixture)
  const repeatedInput = [...rows, rows[0]]
  const doctorAFirst = planQuestionAllocation(repeatedInput, 1000 * 100, {
    maxLevel: 'C',
    seed: 'shared-seed',
    doctorId: 101
  })
  assert.equal(doctorAFirst.success, true)
  assert.equal(
    new Set(doctorAFirst.rows.map((item) => item.id)).size,
    doctorAFirst.rows.length
  )
  recordQuestionAllocation(rows, doctorAFirst.rows, 101)

  const doctorB = planQuestionAllocation(rows, 1000 * 100, {
    maxLevel: 'C',
    seed: 'shared-seed',
    doctorId: 202
  })
  assert.equal(doctorB.success, true)
  assert.deepEqual(
    doctorB.rows.map((item) => item.id),
    doctorAFirst.rows.map((item) => item.id)
  )
  recordQuestionAllocation(rows, doctorB.rows, 202)

  const doctorASecond = planQuestionAllocation(rows, 1000 * 100, {
    maxLevel: 'C',
    seed: 'shared-seed',
    doctorId: 101
  })
  assert.equal(doctorASecond.success, true)
  const doctorAFirstIds = new Set(doctorAFirst.rows.map((item) => item.id))
  assert.ok(doctorASecond.rows.every((item) => !doctorAFirstIds.has(item.id)))

  recordQuestionAllocation(rows, doctorAFirst.rows, 101)
  assert.ok(
    doctorAFirst.rows.every(
      (item) => item.assignment_count === 2 && item.assigned_doctor_ids.length === 2
    )
  )

  const summary = summarizeQuestionBank(rows)
  assert.equal(summary.available_count, rows.length)
  assert.equal(summary.assignment_total, doctorAFirst.rows.length * 2)
})

test('停用题目不参与任务分配', () => {
  const rows = buildQuestionBank(fixture, { copiesPerType: 1 })
  rows.forEach((item) => {
    item.lifecycle_status = 'disabled'
  })
  const unavailable = planQuestionAllocation(rows, 10000, {
    doctorId: 101,
    seed: 'disabled'
  })

  assert.equal(unavailable.success, false)
  assert.deepEqual(unavailable.rows, [])
  assert.equal(summarizeQuestionBank(rows).unavailable_count, rows.length)

  rows[0].lifecycle_status = 'available'
  const onlyEnabled = planQuestionAllocation(rows, 10000, {
    doctorId: 101,
    seed: 'only-enabled'
  })
  assert.equal(onlyEnabled.success, true)
  assert.deepEqual(onlyEnabled.rows.map((item) => item.id), [rows[0].id])
})

test('药品必须从 AI 数智人药师药品库选择且不可伪造属性', () => {
  const catalog = buildDrugCatalog(fixture)
  assert.equal(catalog.length, 100)
  assert.equal(new Set(catalog.map((item) => item.drug_id)).size, 100)
  assert.ok(catalog.every((item) => item.drug_manufacturer))
  assert.ok(catalog.every((item) => !Object.hasOwn(item, 'default_department')))
  assert.equal(new Set(catalog.map((item) => item.drug_manufacturer)).size, 20)

  const selected = resolveDrugSelection(catalog, { drug_id: catalog[0].drug_id })
  assert.deepEqual(selected.data, catalog[0])
  assert.match(
    resolveDrugSelection(catalog, { drug_id: 'DRUG-NOT-FOUND' }).error,
    /不在 AI 数智人药师药品库/
  )
  assert.match(
    resolveDrugSelection(catalog, {
      drug_id: catalog[0].drug_id,
      drug_name: '伪造药品名称'
    }).error,
    /不能手动覆盖/
  )
  assert.match(
    resolveDrugSelection(catalog, {
      drug_id: catalog[0].drug_id,
      drug_manufacturer: '伪造制药厂'
    }).error,
    /不能手动覆盖/
  )
})

test('科室归属只接受医院端已启用的科室配置', () => {
  const options = buildDepartmentOptions(doctorConfigRows)

  assert.deepEqual(options, [
    { label: '心内科', value: '心内科' },
    { label: '内分泌科', value: '内分泌科' },
    { label: '呼吸内科', value: '呼吸内科' },
    { label: '消化内科', value: '消化内科' },
    { label: '神经内科', value: '神经内科' },
    { label: '肾内科', value: '肾内科' }
  ])
  assert.equal(resolveDepartmentSelection(options, '').data, '')
  assert.equal(resolveDepartmentSelection(options, '心内科').data, '心内科')
  assert.equal(
    resolveDepartmentSelection(options, '历史科室', '历史科室').data,
    '历史科室'
  )
  assert.match(resolveDepartmentSelection(options, '全科医学科').error, /已启用的科室/)
  assert.match(
    resolveDepartmentSelection(options, '不存在科室', '历史科室').error,
    /已启用的科室/
  )
  assert.match(resolveDepartmentSelection(options, '不存在科室').error, /已启用的科室/)
})

test('1000 积分由 A/B/C 任务自由组合且不设人为总额上限', () => {
  const rows = buildQuestionBank(fixture)
  const example = planQuestionAllocation(rows, 1000 * 100, {
    maxLevel: 'C',
    seed: 'user-example-1000'
  })

  assert.equal(example.success, true)
  assert.equal(
    example.level_summary.A * 100 +
      example.level_summary.B * 200 +
      example.level_summary.C * 300,
    1000
  )
  assert.equal(
    example.rows.reduce((total, item) => total + item.unit_reward_cent, 0),
    1000 * 100
  )

  const aboveFormerLimit = planQuestionAllocation(rows, 400000 * 100, {
    maxLevel: 'C',
    seed: 'inventory-is-the-limit'
  })
  assert.equal(aboveFormerLimit.success, true)
  assert.equal(aboveFormerLimit.allocated_points, 400000 * 100)
})

test('无法精确组成的目标不会分配部分题目', () => {
  const rows = buildQuestionBank(fixture, { copiesPerType: 1 })
  const invalidStep = planQuestionAllocation(rows, 15000, { seed: 'invalid' })
  const insufficient = planQuestionAllocation(rows, 9999990000, { seed: 'large' })

  assert.equal(invalidStep.success, false)
  assert.deepEqual(invalidStep.rows, [])
  assert.equal(insufficient.success, false)
  assert.deepEqual(insufficient.rows, [])
})
