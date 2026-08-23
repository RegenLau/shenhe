<template>
  <a-drawer
    v-model:visible="visible"
    width="min(720px, 100vw)"
    :title="drawerTitle"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="题目详情加载失败"
        :subtitle="errorMessage"
      >
        <template #extra>
          <a-button type="primary" @click="loadDetail">重新加载</a-button>
        </template>
      </a-result>

      <template v-else-if="detail.id">
        <a-alert :type="statusAlert.type" show-icon class="status-alert">
          {{ statusAlert.text }}
        </a-alert>

        <section class="detail-section">
          <h3>药品信息</h3>
          <div class="drug-detail">
            <div class="drug-image-detail">
              <a-image
                v-if="drugImageUrl"
                :src="drugImageUrl"
                :alt="`${detail.drug_name || '药品'}图片`"
                width="120"
                height="120"
                fit="cover"
              >
                <template #error><span>图片不可用</span></template>
              </a-image>
              <span v-else>暂无图片</span>
            </div>
            <a-descriptions :column="1" bordered>
              <a-descriptions-item label="药品名称">
                {{ detail.drug_name || '—' }}
              </a-descriptions-item>
              <a-descriptions-item label="药品规格">
                {{ drugSpecification }}
              </a-descriptions-item>
              <a-descriptions-item label="生产厂家">
                {{ detail.drug_manufacturer || '—' }}
              </a-descriptions-item>
              <a-descriptions-item label="药品分类">
                {{ detail.drug_type || '—' }}
              </a-descriptions-item>
            </a-descriptions>
          </div>
        </section>

        <section class="detail-section">
          <h3>审核问题</h3>
          <div class="content-block question-content">
            {{ detail.question || '—' }}
          </div>
        </section>

        <section class="detail-section">
          <h3>项目档位与积分</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="项目档位">
              <sa-dict
                v-if="detail.final_level"
                :value="detail.final_level"
                dict="question_level"
              />
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item label="项目积分">
              <strong class="reward-text">{{ formatReward(detail.unit_reward_cent) }}</strong>
            </a-descriptions-item>
            <a-descriptions-item label="基础档位">
              <sa-dict
                v-if="detail.base_level"
                :value="detail.base_level"
                dict="question_level"
              />
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item label="风险标签">
              <div v-if="riskTags.length" class="risk-tag-list">
                <a-tag v-for="tag in riskTags" :key="tag" color="orange">
                  {{ tag }}
                </a-tag>
              </div>
              <span v-else>—</span>
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>AI 回答</h3>
          <div class="content-block answer-content">{{ answerText || '—' }}</div>
        </section>

        <section class="detail-section">
          <h3>题目信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="题目编号">
              {{ detail.question_no || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="问题类型">
              {{ detail.type_name || detail.type_code || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="疾病分类">
              {{ detail.disease_type || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="科室归属">
              {{ detail.department || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="题库状态">
              <sa-dict
                :value="detail.lifecycle_status"
                dict="question_lifecycle_status"
              />
            </a-descriptions-item>
            <a-descriptions-item label="创建时间">
              {{ detail.create_time || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="更新时间">
              {{ detail.update_time || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>来源信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="来源依据">
              <span class="long-text">{{ detail.source_reference || '—' }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>操作记录</h3>
          <a-timeline v-if="auditLogs.length">
            <a-timeline-item
              v-for="(item, index) in auditLogs"
              :key="item.id || `${auditLogTime(item)}-${index}`"
              :label="auditLogTime(item)"
            >
              <div class="audit-entry">
                <strong>{{ auditLogTitle(item) }}</strong>
                <p v-if="auditLogDescription(item)">{{ auditLogDescription(item) }}</p>
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else description="暂无操作记录" />
        </section>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import questionBankApi from '@/api/product/question-bank'

const visible = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const questionId = ref()
const detail = ref({})
const riskTagLabels = ref({})

const drawerTitle = computed(() =>
  detail.value.question_no ? `题目详情 · ${detail.value.question_no}` : '题目详情'
)
const answerText = computed(() => {
  const value = detail.value.answer
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)

  const precautions = Array.isArray(value.precautions)
    ? value.precautions.filter(Boolean).join('\n')
    : value.precautions
  const sections = [
    ['用药建议', value.suggestion],
    ['用法用量', value.dosage],
    ['注意事项', precautions],
    ['药物相互作用', value.interaction],
    ['就医提醒', value.warning]
  ].filter(([, content]) => String(content || '').trim())

  if (sections.length === 1) return String(sections[0][1])
  return sections.map(([label, content]) => `${label}：${content}`).join('\n\n')
})
const containsChinese = (value) => /[\u3400-\u9fff]/u.test(String(value || ''))
const isChineseDisplay = (value) =>
  containsChinese(value) &&
  !/[A-Za-z]/u.test(String(value || '').replace(/\b[ABC]\b/gu, ''))
const normalizeRiskTagLabels = (source = {}) => {
  if (Array.isArray(source)) {
    return Object.fromEntries(
      source
        .map((item) => {
          const value = item?.value ?? item?.code ?? item?.tag
          const label = item?.label ?? item?.name
          return value && label ? [String(value), String(label)] : null
        })
        .filter(Boolean)
    )
  }

  return Object.fromEntries(
    Object.entries(source || {}).map(([value, item]) => [
      String(value),
      String(item?.label ?? item?.name ?? item ?? '')
    ])
  )
}
const riskTags = computed(() => {
  const names = Array.isArray(detail.value.risk_tag_names)
    ? detail.value.risk_tag_names
        .map((item) => item?.label ?? item?.name ?? item)
        .filter(Boolean)
    : []
  const labelMap = normalizeRiskTagLabels(riskTagLabels.value)
  const codes = Array.isArray(detail.value.risk_tags)
    ? detail.value.risk_tags.filter(Boolean)
    : []
  const source = names.length
    ? names
    : codes.map((tag) => labelMap[String(tag)] || '其他风险标签')

  return source
    .map((label) => (isChineseDisplay(label) ? String(label) : '其他风险标签'))
    .filter((label, index, all) => all.indexOf(label) === index)
})
const auditLogs = computed(() =>
  Array.isArray(detail.value.audit_log) ? detail.value.audit_log : []
)

const statusAlert = computed(() => {
  if (detail.value.lifecycle_status === 'disabled') {
    return {
      type: 'error',
      text: '该题目已停用，不会进入新的审核项目；已有项目和审核记录仍保留。'
    }
  }
  if (detail.value.lifecycle_status === 'available') {
    return {
      type: 'success',
      text: '该题目当前可用，可重复分配给不同医生进行独立审核。'
    }
  }
  return { type: 'info', text: '该题目尚为草稿，完成内容核对后可设为可用。' }
})

const drugImageUrl = computed(() =>
  detail.value.drug_image_url || detail.value.drug_image || detail.value.image_url || ''
)
const drugSpecification = computed(() =>
  detail.value.drug_specification || detail.value.specification || '—'
)
const formatReward = (value) => {
  const number = Number(value)
  if (value === undefined || value === null || !Number.isFinite(number)) return '—'
  return `${(number / 100).toLocaleString('zh-CN')} 积分 / 条`
}

const auditLogTime = (item) => {
  if (typeof item === 'string') return ''
  return item?.time || item?.create_time || item?.created_at || item?.operate_time || ''
}

const auditLogTitle = (item) => {
  const actionLabels = {
    created: '创建题目草稿',
    create: '创建题目草稿',
    updated: '更新题目内容',
    update: '更新题目内容',
    status_changed: '更新题库状态',
    enabled: '设为可分配',
    disabled: '停用题目'
  }
  if (typeof item === 'string') {
    return isChineseDisplay(item) ? item : '题目已更新'
  }
  const explicitTitle = item?.action_label || item?.title
  if (isChineseDisplay(explicitTitle)) return explicitTitle
  return actionLabels[String(item?.action || '').toLowerCase()] || '题目已更新'
}

const auditLogDescription = (item) => {
  if (!item || typeof item === 'string') return ''
  const detailText = item.description || item.remark || item.content || ''
  const operator = item.operator || item.operator_name || item.user_name || ''
  const operatorText = !operator
    ? ''
    : isChineseDisplay(operator)
      ? operator
      : '系统管理员'
  const descriptionText = isChineseDisplay(detailText) ? detailText : ''
  return [operatorText, descriptionText].filter(Boolean).join(' · ')
}

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await questionBankApi.read(questionId.value)
    if (response.code === 200 && response.data) {
      detail.value = response.data
      return
    }
    detail.value = {}
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    detail.value = {}
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}

const open = async (id, labels = {}) => {
  questionId.value = id
  detail.value = {}
  riskTagLabels.value = labels || {}
  errorMessage.value = ''
  visible.value = true
  await loadDetail()
}

defineExpose({ open })
</script>

<style scoped lang="less">
.detail-loading {
  display: block;
  width: 100%;
  min-height: 420px;
}

.status-alert {
  margin-bottom: 20px;
}

.detail-section {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
}

.drug-detail {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: stretch;
  gap: 16px;

  :deep(.arco-descriptions) {
    min-width: 0;
  }
}

.drug-image-detail {
  display: flex;
  width: 120px;
  height: 120px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.content-block {
  padding: 16px;
  color: var(--color-text-1);
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.question-content {
  white-space: pre-wrap;
}

.answer-content {
  white-space: pre-wrap;
}

.risk-tag-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.reward-text {
  color: rgb(var(--primary-6));
}

.long-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.audit-entry {
  min-width: 0;

  strong {
    color: var(--color-text-1);
    font-size: 14px;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 20px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 575px) {
  .drug-detail {
    grid-template-columns: 1fr;
  }

  .content-block {
    padding: 12px;
  }
}
</style>
