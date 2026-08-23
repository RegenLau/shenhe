<template>
  <a-drawer
    v-model:visible="visible"
    width="min(880px, 100vw)"
    title="导入到账结果"
    :footer="false"
    :mask-closable="false"
    unmount-on-close
    @cancel="reset"
  >
    <a-steps :current="currentStep" size="small" class="import-steps">
      <a-step>上传结算单</a-step>
      <a-step>校验预览</a-step>
      <a-step>回写完成</a-step>
    </a-steps>

    <section v-if="currentStep === 1" class="step-content">
      <a-alert type="info" show-icon>
        请使用系统导出的“月度结算单” XLSX，填写“到账结果”、“到账时间”、“银行流水号”或“失败原因”后上传。系统会按结算单号和金额双重校验。
      </a-alert>
      <a-alert type="warning" show-icon>
        文件包含身份证号和银行卡号等敏感信息，请仅上传本账期的系统原导出文件。
      </a-alert>

      <a-upload
        v-model:file-list="fileList"
        draggable
        :auto-upload="false"
        :limit="1"
        accept=".xlsx"
        class="result-upload"
      >
        <template #upload-button>
          <div class="upload-trigger">
            <icon-upload :size="36" />
            <strong>点击或拖拽上传到账结果</strong>
            <span>仅支持 .xlsx，文件不超过 10 MB</span>
          </div>
        </template>
      </a-upload>

      <div class="field-note">
        <strong>到账结果填写规则</strong>
        <ul>
          <li>到账：填“已到账”，并填写到账时间和银行流水号。</li>
          <li>失败：填“失败”，并填写失败原因。</li>
        </ul>
      </div>

      <div class="step-actions">
        <a-button type="primary" :loading="previewLoading" @click="previewImport">
          校验并预览
        </a-button>
      </div>
    </section>

    <section v-else-if="currentStep === 2" class="step-content">
      <div class="summary-grid">
        <div><span>文件行数</span><strong>{{ formatNumber(preview.summary.total_rows) }}</strong></div>
        <div><span>可回写</span><strong>{{ formatNumber(preview.summary.eligible_rows) }}</strong></div>
        <div><span>确认到账</span><strong>{{ formatNumber(preview.summary.paid_rows) }}</strong></div>
        <div><span>记录失败</span><strong>{{ formatNumber(preview.summary.failed_rows) }}</strong></div>
        <div><span>跳过/无效</span><strong>{{ formatNumber(preview.summary.skipped_rows) }}</strong></div>
      </div>

      <a-alert
        v-if="preview.summary.eligible_rows === 0"
        type="error"
        show-icon
        class="preview-alert"
      >
        没有可回写记录，请根据逐行提示修改文件后重新上传。
      </a-alert>
      <a-alert
        v-else-if="preview.summary.skipped_rows > 0"
        type="warning"
        show-icon
        class="preview-alert"
      >
        可回写 {{ preview.summary.eligible_rows }} 笔，另有 {{ preview.summary.skipped_rows }} 笔会跳过且不改变原状态。
      </a-alert>
      <a-alert v-else type="success" show-icon class="preview-alert">
        全部 {{ preview.summary.eligible_rows }} 笔校验通过。
      </a-alert>

      <a-table
        :data="preview.rows"
        :pagination="false"
        :bordered="{ wrapper: true, cell: false }"
        :scroll="{ x: 1240 }"
        row-key="row_no"
      >
        <template #columns>
          <a-table-column title="行号" data-index="row_no" :width="70" />
          <a-table-column title="结算单号" data-index="settlement_no" :width="190">
            <template #cell="{ record }"><span class="number-text">{{ record.settlement_no || '—' }}</span></template>
          </a-table-column>
          <a-table-column title="医生" data-index="doctor_name" :width="110" />
          <a-table-column title="到账金额" data-index="amount_yuan" :width="120" align="right">
            <template #cell="{ record }">{{ record.amount_yuan || '—' }} 元</template>
          </a-table-column>
          <a-table-column title="到账结果" data-index="payment_result" :width="110" />
          <a-table-column title="系统状态" data-index="current_status" :width="110" align="center">
            <template #cell="{ record }">
              <sa-dict
                v-if="record.current_status"
                :value="record.current_status"
                dict="monthly_settlement_order_status"
              />
              <span v-else>—</span>
            </template>
          </a-table-column>
          <a-table-column title="到账时间/失败原因" :width="270">
            <template #cell="{ record }">
              <span>{{ record.payment_result === '失败' ? record.failure_reason : record.paid_at || '—' }}</span>
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
          确认回写 {{ preview.summary.eligible_rows }} 笔
        </a-button>
      </div>
    </section>

    <section v-else class="step-content">
      <a-result status="success" title="到账结果回写完成">
        <template #subtitle>
          已按结算单号和金额更新本账期记录，跳过记录保持原状态。
        </template>
      </a-result>
      <div class="result-grid">
        <div><span>已确认到账</span><strong>{{ formatNumber(result.paid_count) }}</strong></div>
        <div><span>已记录失败</span><strong>{{ formatNumber(result.failed_count) }}</strong></div>
        <div><span>跳过未更新</span><strong>{{ formatNumber(result.skipped_count) }}</strong></div>
      </div>
      <div class="step-actions">
        <a-button type="primary" @click="close">完成</a-button>
      </div>
    </section>
  </a-drawer>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import withdrawalApi from '@/api/product/withdrawal'

const emit = defineEmits(['success'])
const props = defineProps({
  cycleId: { type: Number, required: true }
})
const visible = ref(false)
const currentStep = ref(1)
const fileList = ref([])
const previewLoading = ref(false)
const confirmLoading = ref(false)
const emptySummary = { total_rows: 0, eligible_rows: 0, paid_rows: 0, failed_rows: 0, skipped_rows: 0 }
const preview = reactive({ preview_id: '', file_name: '', rows: [], summary: { ...emptySummary } })
const result = reactive({ paid_count: 0, failed_count: 0, skipped_count: 0 })
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const validationColor = (status) => status === 'eligible' ? 'green' : status === 'skipped' ? 'orange' : 'red'
const validationLabel = (status) => status === 'eligible' ? '可回写' : status === 'skipped' ? '已跳过' : '无效'
const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
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
  Object.assign(preview, { preview_id: '', file_name: '', rows: [], summary: { ...emptySummary } })
  Object.assign(result, { paid_count: 0, failed_count: 0, skipped_count: 0 })
}
const open = () => { reset(); visible.value = true }
const close = () => { visible.value = false }
const backToUpload = () => { currentStep.value = 1; fileList.value = [] }

const previewImport = async () => {
  const fileItem = fileList.value[0]
  const file = fileItem?.file
  if (!file) {
    Message.warning('请先选择 XLSX 到账结果文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    Message.error('到账结果文件不能超过 10 MB')
    return
  }
  previewLoading.value = true
  try {
    const response = await withdrawalApi.previewMonthlyResultImport({
      cycle_id: props.cycleId,
      file_name: fileItem.name || file.name,
      file_size: file.size,
      file_base64: await readFileAsBase64(file)
    })
    if (response.code === 200) {
      Object.assign(preview, response.data)
      currentStep.value = 2
    }
  } catch {
    Message.error('到账结果校验失败，请检查网络后重试')
  } finally {
    previewLoading.value = false
  }
}
const confirmImport = async () => {
  confirmLoading.value = true
  try {
    const response = await withdrawalApi.confirmMonthlyResultImport(preview.preview_id)
    if (response.code === 200) {
      Object.assign(result, response.data)
      currentStep.value = 3
      emit('success')
    }
  } catch {
    Message.error('到账结果回写失败，请重新校验后再试')
  } finally {
    confirmLoading.value = false
  }
}
defineExpose({ open })
</script>

<style scoped lang="less">
.import-steps { margin-bottom: 24px; }
.step-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.result-upload { width: 100%; }
.upload-trigger {
  display: flex;
  min-height: 150px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--color-text-2);
  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}
.field-note {
  padding: 14px 16px;
  background: var(--color-fill-1);
  border-radius: var(--border-radius-medium);
  ul {
    margin: 8px 0 0;
    padding-left: 20px;
    color: var(--color-text-2);
    line-height: 24px;
  }
}
.summary-grid,
.result-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: var(--color-fill-1);
    border-radius: var(--border-radius-medium);
  }
  span { color: var(--color-text-3); font-size: 12px; }
  strong { color: var(--color-text-1); font-size: 20px; }
}
.result-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.preview-alert { margin-top: 0; }
.validation-cell {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  span { line-height: 22px; }
}
.number-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
.step-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
.step-actions--between { justify-content: space-between; }
@media (max-width: 767px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .result-grid { grid-template-columns: 1fr; }
}
</style>
