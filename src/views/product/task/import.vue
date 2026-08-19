<template>
  <a-drawer
    v-model:visible="visible"
    width="min(760px, 100vw)"
    title="导入名单并创建任务"
    :footer="false"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-steps :current="currentStep" size="small" class="import-steps">
      <a-step>上传名单</a-step>
      <a-step>校验预览</a-step>
      <a-step>创建完成</a-step>
    </a-steps>

    <section v-if="currentStep === 1" class="step-content">
      <a-alert type="info" show-icon>
        模板需填写基金会名称、项目名称、项目标识、医生姓名、手机号、任务积分和创建日期（如
        2026-08-05）。系统会从题库随机匹配 100 / 200 / 300
        积分题目，精确组成每行任务积分；同一医生同一创建日期不能重复导入；基金会、项目和项目标识须与「组织管理」中维护的层级一致。
      </a-alert>

      <a-upload
        v-model:file-list="fileList"
        draggable
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.csv"
        class="roster-upload"
      >
        <template #upload-button>
          <div class="upload-trigger">
            <icon-upload :size="36" />
            <strong>点击或拖拽上传名单</strong>
            <span>支持 .xlsx / .csv，文件不超过 10MB</span>
          </div>
        </template>
      </a-upload>

      <div class="template-fields">
        <h3>模板字段</h3>
        <div class="field-list">
          <span>基金会名称</span>
          <span>项目名称</span>
          <span>项目标识</span>
          <span>医生姓名</span>
          <span>手机号</span>
          <span>任务积分</span>
          <span>创建日期</span>
        </div>
      </div>

      <div class="step-actions step-actions--between">
        <a-button :loading="downloading" @click="downloadTemplate">
          <template #icon><icon-download /></template>
          下载导入模板
        </a-button>
        <a-button type="primary" :loading="previewLoading" @click="previewImport">
          校验并预览
        </a-button>
      </div>
    </section>

    <section v-else-if="currentStep === 2" class="step-content">
      <div class="summary-grid">
        <div>
          <span>名单行数</span>
          <strong>{{ formatNumber(preview.summary.total_rows) }}</strong>
        </div>
        <div>
          <span>目标总积分</span>
          <strong>{{ formatPoints(summaryTargetPoints) }}</strong>
        </div>
        <div>
          <span>匹配题数</span>
          <strong>{{ formatNumber(summaryMatchedItemCount) }} 题</strong>
        </div>
        <div class="level-summary-card">
          <span>A / B / C 题数</span>
          <div class="level-counts">
            <a-tag color="green">A {{ levelCount(summaryLevelSummary, 'A') }}</a-tag>
            <a-tag color="orange">B {{ levelCount(summaryLevelSummary, 'B') }}</a-tag>
            <a-tag color="red">C {{ levelCount(summaryLevelSummary, 'C') }}</a-tag>
          </div>
        </div>
      </div>

      <a-alert
        v-if="preview.summary.error_rows"
        type="error"
        show-icon
        class="preview-alert"
      >
        有 {{ preview.summary.error_rows }} 行数据未通过校验。请修正文件后重新上传，本次不会创建任何账号或任务。
      </a-alert>
      <a-alert v-else type="success" show-icon class="preview-alert">
        全部 {{ preview.summary.valid_rows }} 行校验通过，将创建
        {{ preview.summary.task_count }} 个任务单（新建账号
        {{ preview.summary.new_account_count }} 个、复用账号
        {{ preview.summary.reused_account_count }} 个），目标总积分
        {{ formatPoints(summaryTargetPoints) }}。
      </a-alert>

      <a-table
        :data="preview.rows"
        :pagination="false"
        :bordered="{ wrapper: true, cell: false }"
        :scroll="{ x: 1560 }"
        row-key="row_no"
      >
        <template #columns>
          <a-table-column title="行号" data-index="row_no" :width="70" />
          <a-table-column title="基金会" data-index="foundation_name" :width="170">
            <template #cell="{ record }">
              {{ record.foundation_name || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="项目" data-index="project_name" :width="150">
            <template #cell="{ record }">
              {{ record.project_name || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="项目标识" data-index="identifier_name" :width="150">
            <template #cell="{ record }">
              {{ record.identifier_name || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="医生姓名" data-index="doctor_name" :width="110" />
          <a-table-column title="手机号" data-index="doctor_phone" :width="130" />
          <a-table-column title="创建日期" data-index="create_date" :width="120">
            <template #cell="{ record }">
              {{ getCreateDate(record) }}
            </template>
          </a-table-column>
          <a-table-column title="任务积分" data-index="target_points" :width="110">
            <template #cell="{ record }">
              {{ formatPoints(getTargetPoints(record)) }}
            </template>
          </a-table-column>
          <a-table-column title="匹配题数" data-index="matched_item_count" :width="100">
            <template #cell="{ record }">
              {{ formatNumber(getMatchedItemCount(record)) }} 题
            </template>
          </a-table-column>
          <a-table-column title="A / B / C" data-index="level_summary" :width="180">
            <template #cell="{ record }">
              <div class="level-counts level-counts--compact">
                <a-tag color="green">A {{ levelCount(record.level_summary, 'A') }}</a-tag>
                <a-tag color="orange">B {{ levelCount(record.level_summary, 'B') }}</a-tag>
                <a-tag color="red">C {{ levelCount(record.level_summary, 'C') }}</a-tag>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="账号处理" data-index="account_action" :width="110">
            <template #cell="{ record }">
              <a-tag
                v-if="['create', 'reuse'].includes(record.account_action)"
                :color="record.account_action === 'create' ? 'orange' : 'green'"
              >
                {{ record.account_action === 'create' ? '新建账号' : '复用账号' }}
              </a-tag>
              <span v-else>—</span>
            </template>
          </a-table-column>
          <a-table-column title="校验结果" data-index="validation_status" :width="230">
            <template #cell="{ record }">
              <div v-if="record.validation_status === 'invalid'" class="validation-error">
                <a-tag color="red">未通过</a-tag>
                <span>{{ getValidationMessage(record) }}</span>
              </div>
              <a-tag v-else color="green">已通过</a-tag>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <div class="step-actions">
        <a-button @click="backToUpload">重新选择文件</a-button>
        <a-button
          type="primary"
          :loading="confirmLoading"
          :disabled="preview.summary.error_rows > 0"
          @click="confirmImport"
        >
          确认导入并创建任务
        </a-button>
      </div>
    </section>

    <section v-else class="step-content">
      <a-result status="success" title="名单导入完成">
        <template #subtitle>
          医生账号和审核任务已同时创建，医生使用名单中的手机号登录小程序后即可查看任务。
        </template>
      </a-result>

      <div class="result-grid">
        <div>
          <span>已创建账号</span>
          <strong>{{ formatNumber(result.created_account_count) }}</strong>
        </div>
        <div>
          <span>已复用账号</span>
          <strong>{{ formatNumber(result.reused_account_count) }}</strong>
        </div>
        <div>
          <span>已创建任务</span>
          <strong>{{ formatNumber(result.created_task_count) }}</strong>
        </div>
        <div>
          <span>任务总积分</span>
          <strong>{{ formatPoints(resultTotalPoints) }}</strong>
        </div>
        <div>
          <span>匹配题数</span>
          <strong>{{ formatNumber(resultMatchedItemCount) }} 题</strong>
        </div>
        <div class="level-summary-card">
          <span>A / B / C 题数</span>
          <div class="level-counts">
            <a-tag color="green">A {{ levelCount(result.level_summary, 'A') }}</a-tag>
            <a-tag color="orange">B {{ levelCount(result.level_summary, 'B') }}</a-tag>
            <a-tag color="red">C {{ levelCount(result.level_summary, 'C') }}</a-tag>
          </div>
        </div>
      </div>

      <div class="batch-no">导入批次：{{ result.batch_no }}</div>

      <div class="step-actions">
        <a-button type="primary" @click="close">完成</a-button>
      </div>
    </section>
  </a-drawer>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import taskApi from '@/api/product/task'

const emit = defineEmits(['success'])

const visible = ref(false)
const currentStep = ref(1)
const fileList = ref([])
const previewLoading = ref(false)
const confirmLoading = ref(false)
const downloading = ref(false)

const emptySummary = {
  total_rows: 0,
  valid_rows: 0,
  error_rows: 0,
  new_account_count: 0,
  reused_account_count: 0,
  task_count: 0,
  total_target_points: 0,
  matched_item_count: 0,
  level_summary: { A: 0, B: 0, C: 0 }
}

const preview = reactive({
  preview_token: '',
  preview_id: '',
  file_name: '',
  rows: [],
  summary: { ...emptySummary }
})

const result = reactive({
  batch_no: '',
  created_account_count: 0,
  reused_account_count: 0,
  created_task_count: 0,
  assigned_item_count: 0,
  matched_item_count: 0,
  total_target_points: 0,
  total_reward_cent: 0,
  level_summary: { A: 0, B: 0, C: 0 }
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(value)} 积分`

const levelCount = (summary, level) => {
  const normalizedLevel = String(level).toUpperCase()
  return formatNumber(
    summary?.[normalizedLevel] ??
      summary?.[normalizedLevel.toLowerCase()] ??
      summary?.[`${normalizedLevel.toLowerCase()}_count`] ??
      0
  )
}

const summaryTargetPoints = computed(() => {
  if (preview.summary.total_target_points != null) {
    return Number(preview.summary.total_target_points || 0)
  }
  return Number(preview.summary.total_reward_cent || 0) / 100
})

const summaryMatchedItemCount = computed(
  () =>
    Number(
      preview.summary.matched_item_count ??
        preview.summary.total_item_count ??
        0
    ) || 0
)

const summaryLevelSummary = computed(
  () => preview.summary.level_summary || { A: 0, B: 0, C: 0 }
)

const resultTotalPoints = computed(() => {
  if (result.total_target_points != null) {
    return Number(result.total_target_points || 0)
  }
  return Number(result.total_reward_cent || 0) / 100
})

const resultMatchedItemCount = computed(
  () => Number(result.matched_item_count ?? result.assigned_item_count ?? 0) || 0
)

const getCreateDate = (record) =>
  record.create_date || record.creation_date || record.import_date || '—'

const getTargetPoints = (record) => {
  if (record.target_points != null) return Number(record.target_points || 0)
  return Number(record.total_reward_cent || 0) / 100
}

const getMatchedItemCount = (record) =>
  Number(record.matched_item_count ?? record.item_count ?? 0) || 0

const getValidationMessage = (record) => {
  if (record.validation_message) return record.validation_message
  if (Array.isArray(record.errors)) return record.errors.join('；')
  return '数据未通过校验'
}

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const [, content = ''] = String(reader.result || '').split(',', 2)
      resolve(content)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const reset = () => {
  currentStep.value = 1
  fileList.value = []
  Object.assign(preview, {
    preview_token: '',
    preview_id: '',
    file_name: '',
    rows: [],
    summary: { ...emptySummary }
  })
  Object.assign(result, {
    batch_no: '',
    created_account_count: 0,
    reused_account_count: 0,
    created_task_count: 0,
    assigned_item_count: 0,
    matched_item_count: 0,
    total_target_points: 0,
    total_reward_cent: 0,
    level_summary: { A: 0, B: 0, C: 0 }
  })
}

const open = () => {
  reset()
  visible.value = true
}

const close = () => {
  visible.value = false
}

const downloadTemplate = async () => {
  downloading.value = true
  try {
    const response = await taskApi.downloadTemplate()
    if (response?.status === 200) {
      tool.download(response)
      Message.success('导入模板已开始下载')
    }
  } catch {
    Message.error('导入模板下载失败，请稍后重试')
  } finally {
    downloading.value = false
  }
}

const previewImport = async () => {
  const fileItem = fileList.value[0]
  if (!fileItem) {
    Message.warning('请先选择名单文件')
    return
  }

  const file = fileItem.file
  if (!file) {
    Message.error('无法读取名单文件，请重新选择')
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    Message.error('名单文件不能超过 10MB')
    return
  }

  const fileName = fileItem.name || file.name
  const fileType = String(fileName).split('.').pop()?.toLowerCase()
  if (!['xlsx', 'csv'].includes(fileType)) {
    Message.error('仅支持 .xlsx 或 .csv 名单文件')
    return
  }

  previewLoading.value = true
  try {
    const payload = {
      file_name: fileName,
      file_type: fileType,
      file_size: file.size,
      ...(fileType === 'xlsx'
        ? { file_content_base64: await readFileAsBase64(file) }
        : { file_content: await file.text() })
    }
    const response = await taskApi.previewImport(payload)

    if (response.code === 200) {
      const data = response.data || {}
      Object.assign(preview, data, {
        preview_token: data.preview_token || data.preview_id || ''
      })
      currentStep.value = 2
    }
  } catch {
    Message.error('名单校验失败，请检查网络后重试')
  } finally {
    previewLoading.value = false
  }
}

const backToUpload = () => {
  currentStep.value = 1
  fileList.value = []
}

const confirmImport = async () => {
  confirmLoading.value = true
  try {
    const response = await taskApi.confirmImport(preview.preview_token)
    if (response.code === 200) {
      Object.assign(result, response.data)
      currentStep.value = 3
      emit('success')
    }
  } catch {
    Message.error('任务创建失败，本次未导入任何数据，请重试')
  } finally {
    confirmLoading.value = false
  }
}

defineExpose({ open })
</script>

<style scoped lang="less">
.import-steps {
  margin-bottom: 24px;
}

.step-content {
  display: flex;
  min-height: calc(100vh - 150px);
  flex-direction: column;
  gap: 20px;
}

.roster-upload {
  width: 100%;
}

.upload-trigger {
  display: flex;
  min-height: 190px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: var(--color-text-3);
  background: var(--color-fill-1);
  border: 1px dashed var(--color-border-3);
  border-radius: var(--border-radius-medium);

  svg {
    color: rgb(var(--primary-6));
  }

  strong {
    color: var(--color-text-1);
    font-size: 16px;
  }

  span {
    font-size: 12px;
  }
}

.template-fields {
  padding: 16px;
  background: var(--color-fill-1);
  border-radius: var(--border-radius-medium);

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 14px;
  }
}

.field-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  span {
    padding: 6px 12px;
    color: var(--color-text-2);
    font-size: 13px;
    background: var(--color-bg-2);
    border: 1px solid var(--color-border-1);
    border-radius: var(--border-radius-small);
  }
}

.summary-grid,
.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;

  div {
    display: flex;
    padding: 16px;
    flex-direction: column;
    background: var(--color-fill-1);
    border-radius: var(--border-radius-medium);
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    margin-top: 6px;
    color: var(--color-text-1);
    font-size: 20px;
  }
}

.level-counts {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.level-counts--compact {
  margin-top: 0;
  flex-wrap: nowrap;
}

.validation-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  span {
    color: rgb(var(--danger-6));
    font-size: 12px;
    line-height: 22px;
    white-space: normal;
  }
}

.preview-alert {
  flex: 0 0 auto;
}

.batch-no {
  color: var(--color-text-3);
  text-align: center;
}

.step-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-1);
}

.step-actions--between {
  justify-content: space-between;
}

@media (max-width: 575px) {
  .summary-grid,
  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .step-actions,
  .step-actions--between {
    align-items: stretch;
    flex-direction: column-reverse;

    button {
      width: 100%;
    }
  }
}
</style>
