<template>
  <a-drawer
    v-model:visible="visible"
    width="min(720px, 100vw)"
    title="医生认证详情"
    :footer="isPending"
    :mask-closable="!reviewing"
    :esc-to-close="!reviewing"
    unmount-on-close
  >
    <a-spin :loading="loading" class="detail-loading">
      <a-result
        v-if="!loading && errorMessage"
        status="error"
        title="认证详情加载失败"
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
          <h3>医生信息</h3>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="姓名">
              {{ detail.name || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="手机号">
              {{ maskPhone(detail.phone) }}
            </a-descriptions-item>
            <a-descriptions-item label="医院名称">
              {{ practiceValue(detail.hospital) }}
            </a-descriptions-item>
            <a-descriptions-item label="科室">
              {{ practiceValue(detail.department) }}
            </a-descriptions-item>
            <a-descriptions-item label="职称">
              {{ practiceValue(detail.title) }}
            </a-descriptions-item>
            <a-descriptions-item label="账号状态">
              <sa-dict
                :value="detail.account_status"
                dict="doctor_account_status"
                render="span"
              />
            </a-descriptions-item>
            <a-descriptions-item label="认证状态">
              <sa-dict
                :value="detail.certification_status"
                dict="doctor_certification_status"
                render="span"
              />
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>认证资料</h3>
          <a-empty
            v-if="detail.certification_status === 'unsubmitted'"
            description="医生尚未提交认证资料"
          />
          <a-descriptions v-else :column="1" bordered>
            <a-descriptions-item label="证件类型">
              {{ detail.certificate_type || '—' }}
              <span class="cert-type-hint">医师资格证 / 医师执业证书 / 工作证·职称证任选其一</span>
            </a-descriptions-item>
            <a-descriptions-item label="证件姓名">
              {{ detail.certificate_holder_name || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="身份证号">
              {{ detail.id_card_number_masked || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="证件照片">
              <div v-if="detail.certificate_image_url" class="certificate-file">
                <a-image
                  class="certificate-preview"
                  :src="detail.certificate_image_url"
                  :width="240"
                  :height="140"
                  fit="cover"
                />
                <div class="certificate-meta">
                  <strong>{{ detail.certificate_attachment_name }}</strong>
                  <span>已添加水印，仅用于平台人工复审；原型使用脱敏示意图</span>
                </div>
              </div>
              <span v-else>—</span>
            </a-descriptions-item>
            <a-descriptions-item label="提交时间">
              {{ detail.certification_submit_time || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="审核时间">
              {{ detail.certification_review_time || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="审核人">
              {{ detail.certification_reviewer || '—' }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="detail.certification_status === 'rejected'"
              label="不通过原因"
            >
              {{ detail.certification_reject_reason || '—' }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section v-if="isPending" class="detail-section review-section">
          <h3>人工复审</h3>
          <div class="review-confirmation">
            <a-checkbox
              v-model="materialConfirmed"
              @change="materialError = ''"
            >
              已核对证件姓名、身份证号、医院和执业证书信息一致
            </a-checkbox>
            <p v-if="materialError" class="review-error">{{ materialError }}</p>
          </div>
          <a-form :model="reviewForm" layout="vertical">
            <a-form-item
              label="不通过原因"
              :validate-status="reasonError ? 'error' : undefined"
              :help="reasonError || '仅在选择“认证不通过”时必填'"
            >
              <a-textarea
                v-model="rejectReason"
                placeholder="请说明认证资料存在的问题"
                :max-length="200"
                show-word-limit
                allow-clear
                @input="reasonError = ''"
              />
            </a-form-item>
          </a-form>
        </section>
      </template>
    </a-spin>

    <template #footer>
      <a-space>
        <a-button :disabled="Boolean(reviewing)" @click="visible = false">
          关闭
        </a-button>
        <a-button
          status="danger"
          :loading="reviewing === 'rejected'"
          :disabled="Boolean(reviewing)"
          @click="submitReview('rejected')"
        >
          认证不通过
        </a-button>
        <a-popconfirm
          content="确认已完成材料核对，并通过该医生认证吗？"
          position="top"
          @ok="submitReview('approved')"
        >
          <a-button
            type="primary"
            :loading="reviewing === 'approved'"
            :disabled="Boolean(reviewing)"
          >
            认证通过
          </a-button>
        </a-popconfirm>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import certificationApi from '@/api/product/doctor-certification'

const emit = defineEmits(['success'])
const visible = ref(false)
const loading = ref(false)
const reviewing = ref('')
const errorMessage = ref('')
const doctorId = ref()
const detail = ref({})
const rejectReason = ref('')
const reasonError = ref('')
const materialConfirmed = ref(false)
const materialError = ref('')
const reviewForm = {}

const isPending = computed(
  () => detail.value.certification_status === 'pending'
)

const statusAlert = computed(() => {
  const status = detail.value.certification_status
  if (status === 'pending') {
    return { type: 'warning', text: '认证资料等待人工复审，请核对医生信息后提交结果。' }
  }
  if (status === 'approved') {
    return { type: 'success', text: '该医生的认证资料已通过人工复审。' }
  }
  if (status === 'rejected') {
    return { type: 'error', text: '该医生的认证资料未通过人工复审；不通过原因已记录，需待医生端后续支持重新提交。' }
  }
  return { type: 'info', text: '该医生尚未提交认证资料，当前无需审核。' }
})

const maskPhone = (value) =>
  String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '—'

const practiceValue = (value) => {
  return value && value !== '待补充' ? value : '待补充'
}

const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await certificationApi.read(doctorId.value)
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

const submitReview = async (result) => {
  const reason = rejectReason.value.trim()
  if (result === 'approved' && !materialConfirmed.value) {
    materialError.value = '请先确认已完成认证材料核对'
    return
  }
  if (result === 'rejected' && !reason) {
    reasonError.value = '请输入认证不通过原因'
    return
  }

  reviewing.value = result
  reasonError.value = ''

  try {
    const response = await certificationApi.review({
      id: doctorId.value,
      result,
      reason: result === 'rejected' ? reason : '',
      material_confirmed: result === 'approved' && materialConfirmed.value
    })

    if (response.code !== 200) return

    detail.value = response.data
    rejectReason.value = ''
    materialConfirmed.value = false
    materialError.value = ''
    Message.success(result === 'approved' ? '医生认证已通过' : '医生认证已驳回')
    emit('success')
  } catch {
    Message.error('认证结果提交失败，请检查网络后重试')
  } finally {
    reviewing.value = ''
  }
}

const open = async (id) => {
  doctorId.value = id
  detail.value = {}
  rejectReason.value = ''
  reasonError.value = ''
  materialConfirmed.value = false
  materialError.value = ''
  reviewing.value = ''
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

.status-alert {
  margin-bottom: 20px;
}

.detail-section {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 12px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 600;
  }
}

.cert-type-hint {
  display: block;
  margin-top: 2px;
  color: var(--color-text-3);
  font-size: 12px;
}

.certificate-file {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.certificate-preview {
  overflow: hidden;
  border: 1px solid var(--color-border-2);
  border-radius: var(--border-radius-medium);
}

.certificate-meta {
  display: flex;
  flex: 1;
  min-width: 220px;
  flex-direction: column;
  gap: 6px;

  strong {
    color: var(--color-text-1);
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 20px;
  }
}

.review-section {
  padding: 16px;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.review-confirmation {
  margin-bottom: 14px;
}

.review-error {
  margin: 6px 0 0 24px;
  color: rgb(var(--danger-6));
  font-size: 12px;
}
</style>