<template>
  <a-drawer
    v-model:visible="visible"
    width="min(820px, 100vw)"
    title="导入已结算名单"
    :footer="false"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-steps :current="currentStep" size="small" class="import-steps">
      <a-step>上传名单</a-step>
      <a-step>校验预览</a-step>
      <a-step>更新完成</a-step>
    </a-steps>

    <section v-if="currentStep === 1" class="step-content">
      <a-alert type="info" show-icon>
        请使用系统导出的待处理名单，将文件中的“结算状态”从“已导出”改为“已结算”后再上传。系统只更新当前仍为“已导出”的申请；待导出或已经结算的记录会跳过。
      </a-alert>

      <a-alert type="warning" show-icon>
        名单包含身份证号、银行卡号等敏感信息，请仅上传基金会反馈的原文件，并妥善保管。
      </a-alert>

      <a-upload
        v-model:file-list="fileList"
        draggable
        :auto-upload="false"
        :limit="1"
        accept=".csv"
        class="roster-upload"
      >
        <template #upload-button>
          <div class="upload-trigger">
            <icon-upload :size="36" />
            <strong>点击或拖拽上传已结算名单</strong>
            <span>支持 .csv，文件不超过 10 MB</span>
          </div>
        </template>
      </a-upload>

      <div class="template-fields">
        <h3>必需字段</h3>
        <div class="field-list">
          <span>申请单号</span>
          <span>结算状态</span>
        </div>
      </div>

      <div class="step-actions">
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
          <span>可更新</span>
          <strong>{{ formatNumber(preview.summary.eligible_rows) }}</strong>
        </div>
        <div>
          <span>待导出跳过</span>
          <strong>{{ formatNumber(preview.summary.pending_rows) }}</strong>
        </div>
        <div>
          <span>其他跳过</span>
          <strong>{{ formatNumber(otherSkippedRows) }}</strong>
        </div>
      </div>

      <a-alert
        v-if="preview.summary.eligible_rows === 0"
        type="error"
        show-icon
        class="preview-alert"
      >
        名单中没有可更新的已导出记录，请根据逐行提示检查后重新上传。
      </a-alert>
      <a-alert
        v-else-if="preview.summary.skipped_rows > 0"
        type="warning"
        show-icon
        class="preview-alert"
      >
        可更新 {{ preview.summary.eligible_rows }} 笔，另有
        {{ preview.summary.skipped_rows }} 笔会跳过且不改变原结算状态。
      </a-alert>
      <a-alert v-else type="success" show-icon class="preview-alert">
        全部 {{ preview.summary.eligible_rows }} 笔校验通过，确认后将更新为“已结算”。
      </a-alert>

      <a-table
        :data="preview.rows"
        :pagination="false"
        :bordered="{ wrapper: true, cell: false }"
        :scroll="{ x: 1100 }"
        row-key="row_no"
      >
        <template #columns>
          <a-table-column title="行号" data-index="row_no" :width="70" />
          <a-table-column title="申请单号" data-index="withdrawal_no" :width="180">
            <template #cell="{ record }">
              <span class="number-text">{{ record.withdrawal_no || '—' }}</span>
            </template>
          </a-table-column>
          <a-table-column title="申请医生" data-index="payee_name" :width="120">
            <template #cell="{ record }">
              {{ record.payee_name || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="文件结算状态" data-index="target_status" :width="120">
            <template #cell="{ record }">
              {{ record.target_status || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="系统结算状态" data-index="current_status" :width="120">
            <template #cell="{ record }">
              <sa-dict
                v-if="record.current_status"
                :value="record.current_status"
                dict="withdrawal_settlement_status"
                render="span"
              />
              <span v-else>—</span>
            </template>
          </a-table-column>
          <a-table-column title="校验结果" data-index="validation_status" :width="300">
            <template #cell="{ record }">
              <div class="validation-cell">
                <a-tag :color="validationColor(record.validation_status)">
                  {{ validationLabel(record.validation_status) }}
                </a-tag>
                <span>{{ record.validation_message }}</span>
              </div>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <div class="step-actions step-actions--between">
        <a-button @click="backToUpload">重新选择文件</a-button>
        <a-button
          type="primary"
          :loading="confirmLoading"
          :disabled="preview.summary.eligible_rows === 0"
          @click="confirmImport"
        >
          确认更新 {{ preview.summary.eligible_rows }} 笔
        </a-button>
      </div>
    </section>

    <section v-else class="step-content">
      <a-result status="success" title="结算状态更新完成">
        <template #subtitle>
          已按申请单号更新可结算记录，跳过记录保持原状态不变。
        </template>
      </a-result>

      <div class="result-grid">
        <div>
          <span>更新为已结算</span>
          <strong>{{ formatNumber(result.updated_count) }}</strong>
        </div>
        <div>
          <span>跳过未更新</span>
          <strong>{{ formatNumber(result.skipped_count) }}</strong>
        </div>
      </div>

      <div class="settled-time">
        结算状态更新时间：{{ result.settled_time || '—' }}
      </div>

      <div class="step-actions">
        <a-button type="primary" @click="close">完成</a-button>
      </div>
    </section>
  </a-drawer>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import withdrawalApi from '@/api/product/withdrawal'

const emit = defineEmits(['success'])

const visible = ref(false)
const currentStep = ref(1)
const fileList = ref([])
const previewLoading = ref(false)
const confirmLoading = ref(false)

const emptySummary = {
  total_rows: 0,
  eligible_rows: 0,
  skipped_rows: 0,
  pending_rows: 0,
  settled_rows: 0,
  invalid_rows: 0
}

const preview = reactive({
  preview_id: '',
  file_name: '',
  rows: [],
  summary: { ...emptySummary }
})

const result = reactive({
  updated_count: 0,
  skipped_count: 0,
  settled_time: ''
})

const otherSkippedRows = computed(() =>
  Math.max(
    Number(preview.summary.skipped_rows || 0) -
      Number(preview.summary.pending_rows || 0),
    0
  )
)

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const validationColor = (status) => {
  if (status === 'eligible') return 'green'
  if (status === 'skipped') return 'orange'
  return 'red'
}
const validationLabel = (status) => {
  if (status === 'eligible') return '可更新'
  if (status === 'skipped') return '已跳过'
  return '无效'
}

const reset = () => {
  currentStep.value = 1
  fileList.value = []
  Object.assign(preview, {
    preview_id: '',
    file_name: '',
    rows: [],
    summary: { ...emptySummary }
  })
  Object.assign(result, {
    updated_count: 0,
    skipped_count: 0,
    settled_time: ''
  })
}

const open = () => {
  reset()
  visible.value = true
}

const close = () => {
  visible.value = false
}

const previewImport = async () => {
  const fileItem = fileList.value[0]
  if (!fileItem) {
    Message.warning('请先选择已结算名单')
    return
  }

  const file = fileItem.file
  if (!file) {
    Message.error('无法读取名单文件，请重新选择')
    return
  }

  previewLoading.value = true
  try {
    const response = await withdrawalApi.previewSettlementImport({
      file_name: fileItem.name || file.name,
      file_size: file.size,
      file_content: await file.text()
    })

    if (response.code === 200) {
      Object.assign(preview, response.data)
      currentStep.value = 2
    }
  } catch {
    Message.error('已结算名单校验失败，请检查网络后重试')
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
    const response = await withdrawalApi.confirmSettlementImport(
      preview.preview_id
    )
    if (response.code === 200) {
      Object.assign(result, response.data)
      currentStep.value = 3
      emit('success')
    }
  } catch {
    Message.error('结算状态更新失败，本次未完成更新，请重试')
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

  strong {
    color: var(--color-text-1);
    font-size: 16px;
    font-weight: 600;
  }

  span {
    font-size: 12px;
  }
}

.template-fields {
  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 600;
  }
}

.field-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  span {
    padding: 12px 16px;
    color: var(--color-text-2);
    background: var(--color-fill-1);
    border-radius: var(--border-radius-small);
  }
}

.summary-grid,
.result-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    background: var(--color-fill-1);
    border-radius: var(--border-radius-medium);
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    color: var(--color-text-1);
    font-size: 22px;
    line-height: 30px;
  }
}

.result-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.preview-alert {
  flex: 0 0 auto;
}

.number-text {
  color: var(--color-text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.validation-cell {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  span {
    min-width: 0;
    color: var(--color-text-2);
    line-height: 20px;
    overflow-wrap: anywhere;
  }
}

.settled-time {
  padding: 12px 16px;
  color: var(--color-text-2);
  background: var(--color-fill-1);
  border-radius: var(--border-radius-small);
  text-align: center;
}

.step-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: auto;
  padding-top: 4px;
}

.step-actions--between {
  justify-content: space-between;
}

@media (max-width: 575px) {
  .step-content {
    min-height: calc(100vh - 130px);
  }

  .summary-grid,
  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-list {
    grid-template-columns: 1fr;
  }

  .step-actions,
  .step-actions--between {
    align-items: stretch;
    flex-direction: column-reverse;

    :deep(.arco-btn) {
      width: 100%;
    }
  }
}
</style>
