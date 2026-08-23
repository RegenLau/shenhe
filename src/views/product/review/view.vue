<template>
  <a-drawer
    v-model:visible="visible"
    width="min(720px, 100vw)"
    title="审核记录详情"
    :footer="false"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="审核记录详情加载失败"
        :subtitle="errorMessage"
      >
        <template #extra>
          <a-button type="primary" @click="loadDetail">重新加载</a-button>
        </template>
      </a-result>

      <template v-else-if="detail.id">
        <section class="detail-section">
          <h3>记录信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="记录编号">
              {{ detail.review_no || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="项目编号">
              {{ detail.task_no || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="审核医生">
              {{ detail.doctor_name || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="绑定手机号">
              {{ detail.doctor_phone || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="执业信息">
              {{ practiceText }}
            </a-descriptions-item>
            <a-descriptions-item label="审核时间">
              {{ detail.review_time || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>审核问题</h3>
          <a-space wrap class="question-tags">
            <a-tag v-if="detail.drug_name">{{ detail.drug_name }}</a-tag>
            <a-tag v-if="detail.drug_type">
              {{ detail.drug_type }}
            </a-tag>
            <a-tag v-if="detail.disease_type">
              {{ detail.disease_type }}
            </a-tag>
          </a-space>
          <div class="content-block">
            {{ detail.question || '—' }}
          </div>
        </section>

        <section class="detail-section">
          <h3>AI 回答</h3>
          <div v-if="answerText" class="content-block">
            {{ answerText }}
          </div>
          <div v-else class="answer-list">
            <article class="answer-block">
              <h4>用药建议</h4>
              <p>{{ answer.suggestion || '—' }}</p>
            </article>
            <article class="answer-block">
              <h4>用法用量</h4>
              <p>{{ answer.dosage || '—' }}</p>
            </article>
            <article class="answer-block">
              <h4>注意事项</h4>
              <ul v-if="precautions.length">
                <li v-for="item in precautions" :key="item">{{ item }}</li>
              </ul>
              <p v-else>—</p>
            </article>
            <article class="answer-block">
              <h4>药物相互作用</h4>
              <p>{{ answer.interaction || '—' }}</p>
            </article>
            <article class="answer-block">
              <h4>就医提醒</h4>
              <p>{{ answer.warning || '—' }}</p>
            </article>
          </div>
        </section>

        <section class="detail-section">
          <h3>医生结论</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="审核结论">
              <sa-dict
                v-if="detail.result"
                :value="detail.result"
                dict="review_result"
                render="span"
              />
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item v-if="isRejected" label="问题类型">
              <sa-dict
                v-if="detail.issue_type"
                :value="detail.issue_type"
                dict="review_issue_type"
                render="span"
              />
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item :label="isRejected ? '不通过原因' : '审核意见'">
              <span class="long-text">{{ detail.review_comment || '—' }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </section>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import reviewApi from '@/api/product/review'

const visible = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const reviewId = ref()
const detail = ref({})

const answerText = computed(() =>
  typeof detail.value.answer === 'string' ? detail.value.answer : ''
)
const answer = computed(() =>
  detail.value.answer && typeof detail.value.answer === 'object'
    ? detail.value.answer
    : {}
)
const precautions = computed(() => {
  if (Array.isArray(answer.value.precautions)) {
    return answer.value.precautions.filter(Boolean)
  }
  return answer.value.precautions ? [answer.value.precautions] : []
})
const isRejected = computed(() => detail.value.result === 'rejected')
const practiceText = computed(() => {
  return [detail.value.hospital, detail.value.department]
    .filter(Boolean)
    .join(' · ') || '—'
})

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await reviewApi.read(reviewId.value)
    if (response.code === 200) {
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

const open = async (id) => {
  reviewId.value = id
  detail.value = {}
  visible.value = true
  await loadDetail()
}

defineExpose({ open })
</script>

<style scoped lang="less">
.detail-loading {
  display: block;
  width: 100%;
  min-height: 360px;
}

.detail-section {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 600;
    line-height: 24px;
  }
}

.question-tags {
  margin-bottom: 12px;
}

.content-block,
.answer-block {
  padding: 16px;
  color: var(--color-text-1);
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.answer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-block {
  h4 {
    margin: 0 0 8px;
    color: var(--color-text-1);
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 0;
    white-space: pre-wrap;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  li + li {
    margin-top: 6px;
  }
}

.long-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 575px) {
  .content-block,
  .answer-block {
    padding: 12px;
  }
}
</style>
