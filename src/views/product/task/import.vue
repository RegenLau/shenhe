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
        模板仅需填写医生姓名、手机号和任务数量。单条审核计酬固定为 ¥50。
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
            <strong>点击或拖拽上传名单</strong>
            <span>V1.0 支持 .csv，文件不超过 10MB</span>
          </div>
        </template>
      </a-upload>

      <div class="template-fields">
        <h3>模板字段</h3>
        <div class="field-list">
          <span>医生姓名</span>
          <span>手机号</span>
          <span>任务数量</span>
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
          <span>名单人数</span>
          <strong>{{ formatNumber(preview.summary.total_rows) }}</strong>
        </div>
        <div>
          <span>新建账号</span>
          <strong>{{ formatNumber(preview.summary.new_account_count) }}</strong>
        </div>
        <div>
          <span>复用账号</span>
          <strong>{{ formatNumber(preview.summary.reused_account_count) }}</strong>
        </div>
        <div>
          <span>分配任务</span>
          <strong>{{ formatNumber(preview.summary.total_item_count) }} 条</strong>
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
        {{ preview.summary.task_count }} 个任务单，预计总计酬
        {{ formatCurrency(preview.summary.total_reward_cent) }}。
      </a-alert>

      <a-table
        :data="preview.rows"
        :pagination="false"
        :bordered="{ wrapper: true, cell: false }"
        :scroll="{ x: 720 }"
        row-key="row_no"
      >
        <template #columns>
          <a-table-column title="行号" data-index="row_no" :width="70" />
          <a-table-column title="医生姓名" data-index="doctor_name" :width="110" />
          <a-table-column title="手机号" data-index="doctor_phone" :width="130" />
          <a-table-column title="任务数量" data-index="item_count" :width="100">
            <template #cell="{ record }">
              {{ formatNumber(record.item_count) }} 条
            </template>
          </a-table-column>
          <a-table-column title="预计计酬" data-index="total_reward_cent" :width="110">
            <template #cell="{ record }">
              {{ formatCurrency(record.total_reward_cent) }}
            </template>
          </a-table-column>
          <a-table-column title="账号处理" data-index="account_action" :width="110">
            <template #cell="{ record }">
              <a-tag :color="record.account_action === 'create' ? 'orange' : 'green'">
                {{ record.account_action === 'create' ? '新建账号' : '复用账号' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="校验结果" data-index="validation_status" :width="110">
            <template #cell="{ record }">
              <a-tooltip
                v-if="record.validation_status === 'invalid'"
                :content="record.validation_message"
              >
                <a-tag color="red">未通过</a-tag>
              </a-tooltip>
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
          <span>任务总量</span>
          <strong>{{ formatNumber(result.assigned_item_count) }} 条</strong>
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
import { reactive, ref } from 'vue'
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
  total_item_count: 0,
  total_reward_cent: 0
}

const preview = reactive({
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
  total_reward_cent: 0
})

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatCurrency = (value) => `¥${formatNumber(Number(value || 0) / 100)}`

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
    batch_no: '',
    created_account_count: 0,
    reused_account_count: 0,
    created_task_count: 0,
    assigned_item_count: 0,
    total_reward_cent: 0
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

  previewLoading.value = true
  try {
    const response = await taskApi.previewImport({
      file_name: fileItem.name || file.name,
      file_size: file.size,
      file_content: await file.text()
    })

    if (response.code === 200) {
      Object.assign(preview, response.data)
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
    const response = await taskApi.confirmImport(preview.preview_id)
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
