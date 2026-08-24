import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ExcelJS from 'exceljs'

const mockRoot = fileURLToPath(new URL('../', import.meta.url))
const token = 'mock-access-token'

const waitForHealth = async (baseUrl, child) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Mock API 启动失败，exitCode=${child.exitCode}`)
    }
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return
    } catch {
      // Wait for the child process to start listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Mock API 启动超时')
}

test('月结全链路：零积分跳过、人工特批、双表导出与到账回写', async (t) => {
  const port = 32000 + (process.pid % 1000)
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: mockRoot,
    env: { ...process.env, MOCK_API_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe']
  })
  let childError = ''
  child.stderr.on('data', (chunk) => { childError += String(chunk) })
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGTERM')
  })
  await waitForHealth(baseUrl, child)

  const api = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    return response.json()
  }

  const initialCycleResponse = await api('/core/product/settlement/cycle/read?id=1')
  assert.equal(initialCycleResponse.code, 200, childError)
  const initialCycle = initialCycleResponse.data
  assert.ok(initialCycle.order_count > 0)
  assert.ok(initialCycle.doctor_settlements.every((order) => order.amount_cent > 0))
  assert.ok(
    initialCycle.doctor_settlements.every(
      (order) => order.settlement_type === 'auto'
    ),
    '月结账期内只能生成系统月结记录，不得包含历史结算数据'
  )
  assert.doesNotMatch(
    JSON.stringify(initialCycle.doctor_settlements),
    /"(?:id_card_no|bank_card_no)"/,
    '普通详情接口不得泄露完整身份证或银行卡号'
  )

  const zeroMonth = await api('/core/product/settlement/cycle/run', {
    method: 'POST',
    body: JSON.stringify({ month: '2026-06' })
  })
  assert.equal(zeroMonth.code, 200)
  assert.equal(zeroMonth.data.cycle, null)
  assert.equal(zeroMonth.data.created_count, 0)
  assert.equal(zeroMonth.data.job.no_settleable_points, true)
  const zeroMonthLogs = await api(
    '/core/product/settlement/job/index?month=2026-06&page=1&limit=10'
  )
  assert.equal(zeroMonthLogs.code, 200)
  assert.equal(zeroMonthLogs.data.total, 1)
  assert.equal(zeroMonthLogs.data.data[0].cycle_id, null)
  assert.match(zeroMonthLogs.data.data[0].result_message, /未生成月结记录/)

  const orderCountBeforeZeroManual = initialCycle.order_count
  const zeroManual = await api('/core/product/settlement/order/manual', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: initialCycle.id,
      doctor_id: 1,
      reason: '验证零积分不生成结算记录'
    })
  })
  assert.equal(zeroManual.code, 422)
  assert.match(zeroManual.message, /没有可结算积分/)
  const cycleAfterZeroManual = await api('/core/product/settlement/cycle/read?id=1')
  assert.equal(cycleAfterZeroManual.data.order_count, orderCountBeforeZeroManual)

  const manualCandidates = await api(
    '/core/product/settlement/manual/candidates?page=1&limit=100'
  )
  assert.equal(manualCandidates.code, 200)
  assert.ok(manualCandidates.data.data.length > 0)
  assert.ok(manualCandidates.data.data.every((item) => item.amount_cent > 0))
  assert.ok(
    !manualCandidates.data.data.some((item) => item.doctor_id === 1),
    '没有可结算积分的医生不得出现在人工结算候选列表'
  )
  assert.ok(manualCandidates.data.data.some((item) => item.doctor_id === 3))

  const overview = await api('/core/product/settlement/doctor/overview?doctor_id=3')
  assert.equal(overview.code, 200)
  assert.equal(overview.data.eligibility.payment_complete, true)
  assert.equal(overview.data.eligibility.certification_complete, false)
  assert.ok(overview.data.estimated_next_settlement_amount_cent > 0)
  const summaryBeforeManual = await api('/core/product/settlement/summary')

  const manual = await api('/core/product/settlement/order/manual', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: initialCycle.id,
      doctor_id: 3,
      reason: '医生线下提供了收款确认，运营人工特批'
    })
  })
  assert.equal(manual.code, 200)
  assert.equal(manual.data.settlement_type, 'manual')
  assert.equal(manual.data.cycle_id, null)
  assert.match(manual.data.settlement_no, /^RGJS/)
  assert.equal(
    manual.data.audit_logs.find((item) => item.action === 'manual_created')?.operator,
    '运营管理员',
    '人工结算审计记录必须标识实际操作角色'
  )
  assert.equal(
    manual.data.amount_cent,
    overview.data.estimated_next_settlement_amount_cent,
    '人工特批必须包含截至当前全部未结积分'
  )
  assert.equal(
    manual.data.lines.reduce((sum, line) => sum + line.amount_cent, 0),
    manual.data.amount_cent
  )
  const cycleAfterManual = await api('/core/product/settlement/cycle/read?id=1')
  assert.equal(
    cycleAfterManual.data.order_count,
    initialCycle.order_count,
    '人工结算单不得计入月结账期的结算单数'
  )
  assert.equal(
    cycleAfterManual.data.deferred_doctor_count,
    initialCycle.deferred_doctor_count,
    '人工结算不得改写历史账期的延期快照'
  )
  const summaryAfterManual = await api('/core/product/settlement/summary')
  assert.equal(
    summaryAfterManual.data.pending_export_count,
    summaryBeforeManual.data.pending_export_count,
    '人工结算单不得计入月结待导出统计'
  )

  const history = await api('/core/product/settlement/history/index?page=1&limit=100')
  assert.equal(history.code, 200)
  const monthlyHistory = history.data.data.find(
    (item) => item.record_type === 'monthly_cycle' && item.cycle_id === initialCycle.id
  )
  const manualHistory = history.data.data.find(
    (item) => item.record_type === 'manual_settlement' && item.record_id === manual.data.id
  )
  const zeroMonthHistory = history.data.data.find(
    (item) => item.record_type === 'monthly_cycle' && item.settlement_month === '2026-06'
  )
  assert.ok(monthlyHistory)
  assert.ok(monthlyHistory.job_no)
  assert.match(monthlyHistory.result_message, /本次纳入 \d+ 位医生/)
  assert.equal(monthlyHistory.order_count, initialCycle.order_count)
  assert.ok(manualHistory)
  assert.equal(manualHistory.cycle_id, null)
  assert.equal(manualHistory.total_amount_cent, manual.data.amount_cent)
  assert.equal(zeroMonthHistory.status, 'not_generated')
  assert.equal(zeroMonthHistory.cycle_id, null)

  const repeatedManual = await api('/core/product/settlement/order/manual', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: initialCycle.id,
      doctor_id: 3,
      reason: '重复特批应被拦截'
    })
  })
  assert.equal(repeatedManual.code, 422)
  assert.match(repeatedManual.message, /没有可结算积分/)
  const candidatesAfterManual = await api(
    '/core/product/settlement/manual/candidates?page=1&limit=100'
  )
  assert.ok(!candidatesAfterManual.data.data.some((item) => item.doctor_id === 3))

  const manualExport = await api('/core/product/settlement/export/create', {
    method: 'POST',
    body: JSON.stringify({ order_ids: [manual.data.id] })
  })
  assert.equal(manualExport.code, 200)
  assert.match(
    manualExport.data.statement_name,
    /^希息药事\d{4} 年 \d{1,2} 月待结算名单_\d{8}\.xlsx$/
  )
  assert.match(
    manualExport.data.detail_name,
    /^希息药事\d{4} 年 \d{1,2} 月结算明细_\d{8}\.xlsx$/
  )
  const manualStatementResponse = await fetch(
    `${baseUrl}${manualExport.data.statement_url}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const manualStatementWorkbook = new ExcelJS.Workbook()
  await manualStatementWorkbook.xlsx.load(
    Buffer.from(await manualStatementResponse.arrayBuffer())
  )
  assert.equal(manualStatementWorkbook.worksheets[0].name, '待结算名单')
  const summaryAfterManualExport = await api('/core/product/settlement/summary')
  assert.equal(
    summaryAfterManualExport.data.processing_count,
    summaryBeforeManual.data.processing_count,
    '人工结算单导出后不得计入月结中统计'
  )

  const pendingOrders = initialCycle.doctor_settlements.filter(
    (order) => order.status === 'pending_export'
  )
  assert.ok(pendingOrders.length > 1, '测试账期必须包含多位待导出医生')
  const pendingOrder = pendingOrders[0]
  const pendingOrderIds = pendingOrders.map((order) => order.id)
  const pendingOrderNos = new Set(
    pendingOrders.map((order) => order.settlement_no)
  )
  const pendingDoctorCount = new Set(
    pendingOrders.map((order) => order.doctor_id)
  ).size
  const exportResponse = await api('/core/product/settlement/export/create', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: initialCycle.id,
      order_ids: pendingOrderIds
    })
  })
  assert.equal(exportResponse.code, 200)
  assert.equal(exportResponse.data.file_count, 2)
  assert.equal(exportResponse.data.doctor_count, pendingDoctorCount)
  assert.equal(exportResponse.data.order_count, pendingOrders.length)
  assert.match(exportResponse.message, /1 份待结算名单和 1 份合并结算明细/)
  assert.match(
    exportResponse.data.statement_name,
    /^希息药事2026 年 7 月待结算名单_\d{8}\.xlsx$/
  )
  assert.match(
    exportResponse.data.detail_name,
    /^希息药事2026 年 7 月结算明细_\d{8}\.xlsx$/
  )

  const statementResponse = await fetch(
    `${baseUrl}${exportResponse.data.statement_url}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const detailResponse = await fetch(`${baseUrl}${exportResponse.data.detail_url}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  assert.match(statementResponse.headers.get('content-type') || '', /spreadsheetml/)
  assert.match(detailResponse.headers.get('content-type') || '', /spreadsheetml/)
  const statementBuffer = Buffer.from(await statementResponse.arrayBuffer())
  const detailBuffer = Buffer.from(await detailResponse.arrayBuffer())

  const statementWorkbook = new ExcelJS.Workbook()
  await statementWorkbook.xlsx.load(statementBuffer)
  const statementSheet = statementWorkbook.worksheets[0]
  assert.equal(statementSheet.name, '待结算名单')
  assert.equal(statementSheet.rowCount, pendingOrders.length + 1)
  const headers = []
  statementSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = cell.text
  })
  assert.deepEqual(headers, [
    '基金会',
    '所属项目',
    '项目标识',
    '结算单号',
    '账期',
    '结算类型',
    '姓名',
    '手机号',
    '身份证号',
    '开户行',
    '开户地',
    '银行卡号',
    '总金额(不含税元)',
    '结算状态',
    '申请时间',
    '附件'
  ])
  const exportedStatementNos = new Set()
  for (let rowNumber = 2; rowNumber <= statementSheet.rowCount; rowNumber += 1) {
    exportedStatementNos.add(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('结算单号') + 1).text
    )
    assert.ok(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('基金会') + 1).text
    )
    assert.ok(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('所属项目') + 1).text
    )
    assert.ok(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('项目标识') + 1).text
    )
    assert.ok(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('开户地') + 1).text
    )
    assert.ok(
      Number(
        statementSheet
          .getRow(rowNumber)
          .getCell(headers.indexOf('总金额(不含税元)') + 1).value
      ) > 0
    )
    assert.equal(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('结算状态') + 1).text,
      '待结算'
    )
    assert.equal(
      statementSheet.getRow(rowNumber).getCell(headers.indexOf('附件') + 1).text,
      '该医师/药师本月审核全部内容'
    )
  }
  assert.deepEqual(exportedStatementNos, pendingOrderNos)

  const detailWorkbook = new ExcelJS.Workbook()
  await detailWorkbook.xlsx.load(detailBuffer)
  const detailSheet = detailWorkbook.worksheets[0]
  assert.equal(detailSheet.name, '医生结算明细')
  assert.ok(detailSheet.rowCount > 1)
  const detailHeaders = []
  detailSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    detailHeaders[column - 1] = cell.text
  })
  assert.deepEqual(detailHeaders, [
    '结算单号',
    '医生姓名',
    '手机号',
    '来源月份',
    '基金会',
    '所属项目',
    '项目标识',
    '药品名称',
    '药品规格',
    '问题类型',
    '审核问题',
    '问题对应答案',
    '审核意见',
    '审核完成时间'
  ])
  const exportedDetailNos = new Set()
  for (let rowNumber = 2; rowNumber <= detailSheet.rowCount; rowNumber += 1) {
    const settlementNo = detailSheet.getRow(rowNumber).getCell(1).text
    assert.ok(pendingOrderNos.has(settlementNo))
    exportedDetailNos.add(settlementNo)
    assert.ok(detailSheet.getRow(rowNumber).getCell(8).text)
  }
  assert.deepEqual(exportedDetailNos, pendingOrderNos)

  const paidRowNumber = pendingOrders.findIndex(
    (order) => order.id === pendingOrder.id
  ) + 2
  const importColumns = ['到账结果', '到账时间', '银行流水号', '失败原因']
  importColumns.forEach((header, index) => {
    statementSheet.getRow(1).getCell(headers.length + index + 1).value = header
  })
  statementSheet.getRow(paidRowNumber).getCell(headers.length + 1).value = '已到账'
  statementSheet.getRow(paidRowNumber).getCell(headers.length + 2).value = '2026-08-23 12:00:00'
  statementSheet.getRow(paidRowNumber).getCell(headers.length + 3).value = 'BANK-TEST-0001'
  const resultBuffer = Buffer.from(await statementWorkbook.xlsx.writeBuffer())
  const preview = await api('/core/product/settlement/resultImportPreview', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: initialCycle.id,
      file_name: '待结算名单-到账结果.xlsx',
      file_size: resultBuffer.length,
      file_base64: resultBuffer.toString('base64')
    })
  })
  assert.equal(preview.code, 200)
  assert.equal(preview.data.summary.eligible_rows, 1)
  assert.equal(preview.data.summary.paid_rows, 1)

  const confirmed = await api('/core/product/settlement/resultImportConfirm', {
    method: 'POST',
    body: JSON.stringify({ preview_id: preview.data.preview_id })
  })
  assert.equal(confirmed.code, 200)
  assert.equal(confirmed.data.paid_count, 1)
  const paidOrder = await api(
    `/core/product/settlement/order/read?id=${pendingOrder.id}`
  )
  assert.equal(paidOrder.data.status, 'paid')
  assert.equal(paidOrder.data.transaction_no, 'BANK-TEST-0001')
})
