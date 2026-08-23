<template>
  <div class="batch-page">
    <header class="page-header">
      <div class="header-main">
        <a-button @click="goBack">
          <template #icon><icon-left /></template>
          返回结算管理
        </a-button>
        <div class="header-title">
          <h1>{{ batch.display_title || '项目结算' }}</h1>
        </div>
      </div>
      <a-space wrap>
        <a-button
          :disabled="!canImport"
          @click="settlementImportRef?.open()"
        >
          <template #icon><icon-upload /></template>
          导入已结算名单
        </a-button>
        <a-button
          type="primary"
          :loading="exporting"
          :disabled="!canExport"
          @click="confirmExport"
        >
          <template #icon><icon-download /></template>
          导出结算文件
        </a-button>
      </a-space>
    </header>

    <a-result
      v-if="!loading && errorMessage"
      status="error"
      title="项目结算加载失败"
      :subtitle="errorMessage"
    >
      <template #extra>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </template>
    </a-result>

    <a-spin v-else :loading="loading" class="batch-content">
      <template v-if="batch.batch_no">
        <a-alert type="info" show-icon class="batch-tip">
          当前结算范围与项目管理中的同编号项目一致。单个医生在本项目的审核条数全部完成后才能结算；部分医生完成时，只导出已完成医生的名单，基金会完成结算后，请在本项目导入名单回写状态。
          点击“导出结算文件”会分别下载结算表和对应医生的审核记录，审核记录包含问题、答案及审核意见。
        </a-alert>

        <a-row :gutter="[16, 16]" class="summary-grid">
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic title="医生数" :value="batch.doctor_count" suffix="位" />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic
                title="可结算医生"
                :value="batch.eligible_doctor_count"
                :suffix="` / ${batch.doctor_count || 0} 位`"
              />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic
                title="审核条数"
                :value="batch.completed_review_count"
                :suffix="` / ${batch.assigned_review_count || 0} 条`"
              />
            </a-card>
          </a-col>
          <a-col :xs="12" :sm="6">
            <a-card :bordered="false">
              <a-statistic
                title="结算积分"
                :value="Number(batch.total_amount_cent || 0) / 100"
                suffix="积分"
              />
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false" class="detail-card" title="医生审核结算">
          <a-table
            v-if="batch.task_settlements?.length"
            :data="batch.task_settlements"
            :pagination="{ pageSize: 10 }"
            :bordered="{ wrapper: true, cell: false }"
            :scroll="{ x: 1520 }"
            row-key="id"
          >
            <template #columns>
              <a-table-column title="医生" data-index="doctor_name" :width="165" fixed="left">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong :title="record.doctor_name">{{ record.doctor_name || '—' }}</strong>
                    <span>{{ record.doctor_phone_masked || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="执业信息" data-index="hospital" :width="220">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong :title="record.hospital">{{ record.hospital || '—' }}</strong>
                    <span>{{ record.department || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="审核条数" data-index="completed_review_count" :width="145" align="right">
                <template #cell="{ record }">
                  <strong>
                    {{ formatNumber(record.completed_review_count) }} /
                    {{ formatNumber(record.assigned_review_count) }} 条
                  </strong>
                </template>
              </a-table-column>
              <a-table-column title="结算积分" data-index="amount_cent" :width="120" align="right">
                <template #cell="{ record }">
                  <strong>{{ formatPoints(record.amount_cent) }}</strong>
                </template>
              </a-table-column>
              <a-table-column title="收款账户" data-index="bank_name" :width="195">
                <template #cell="{ record }">
                  <div class="stack-cell">
                    <strong :title="record.bank_name">{{ record.bank_name || '—' }}</strong>
                    <span>{{ record.bank_card_masked || '—' }}</span>
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="结算状态" data-index="status" :width="110" align="center">
                <template #cell="{ record }">
                  <sa-dict :value="record.status" dict="settlement_doctor_status" />
                </template>
              </a-table-column>
              <a-table-column title="结算说明" data-index="settlement_block_reason" :width="260">
                <template #cell="{ record }">
                  <span v-if="record.settlement_block_reason" class="blocked-text">
                    {{ record.settlement_block_reason }}
                  </span>
                  <span v-else>—</span>
                </template>
              </a-table-column>
              <a-table-column title="审核完成时间" data-index="review_completed_at" :width="165" />
            </template>
          </a-table>
          <a-empty v-else description="当前项目暂无医生审核结算" />
        </a-card>
      </template>
    </a-spin>

    <settlement-import
      ref="settlementImportRef"
      :batch-no="batchNo"
      @success="loadDetail"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import tool from '@/utils/tool'
import withdrawalApi from '@/api/product/withdrawal'
import SettlementImport from './settlement-import.vue'

const route = useRoute()
const router = useRouter()
const batchNo = String(route.params.batchNo || '')
const loading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')
const settlementImportRef = ref()
const batch = reactive({ task_settlements: [] })

const canExport = computed(() =>
  batch.task_settlements?.some(
    (item) => item.status === 'pending' && item.settlement_eligible
  )
)
const canImport = computed(() =>
  batch.task_settlements?.some(
    (item) => item.settlement_eligible && ['exported', 'partial'].includes(item.status)
  )
)
const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')
const formatPoints = (value) => `${formatNumber(Number(value || 0) / 100)} 积分`
const loadDetail = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await withdrawalApi.readBatch(batchNo)
    if (response.code === 200) {
      Object.assign(batch, { task_settlements: [] }, response.data)
      return
    }
    errorMessage.value = response.message || '请稍后重新加载'
  } catch {
    errorMessage.value = '网络连接异常，请检查后重试'
  } finally {
    loading.value = false
  }
}

const exportBatch = async () => {
  exporting.value = true
  try {
    const reviewResponse = await withdrawalApi.exportBatchReviewRecords(batchNo)
    if (reviewResponse?.status !== 200) {
      Message.error('医生审核记录导出失败，请稍后重试')
      return
    }

    tool.download(reviewResponse)

    const settlementResponse = await withdrawalApi.exportBatch(batchNo)
    if (settlementResponse?.status !== 200) {
      Message.error('结算表导出失败，医生审核记录已下载，请重试结算表导出')
      return
    }

    tool.download(settlementResponse)
    Message.success('结算表和医生审核记录已分别导出')
    await loadDetail()
  } catch {
    Message.error('结算文件导出失败，请检查网络后重试')
  } finally {
    exporting.value = false
  }
}

const confirmExport = () => {
  Modal.confirm({
    title: '确认导出当前项目的结算文件',
    content:
      '本次将分别下载结算表和医生审核记录。文件包含医生联系方式、银行卡号及审核问答等业务信息，仅限结算使用，请妥善保管。',
    width: 'min(420px, calc(100vw - 32px))',
    okText: '确认导出',
    onOk: exportBatch
  })
}

const goBack = () => router.push({ name: 'productWithdrawal' })
onMounted(loadDetail)
</script>

<style scoped lang="less">
.batch-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);
}

.header-main {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.header-title {
  min-width: 0;

  h1 {
    margin: 0;
    color: var(--color-text-1);
    font-size: 20px;
    line-height: 28px;
  }

}

.batch-content {
  display: block;
  width: 100%;
  min-height: 420px;
}

.batch-tip,
.detail-card {
  margin-top: 16px;
}

.batch-tip {
  margin-bottom: 16px;
}

.summary-grid {
  margin-top: 0;
}

.stack-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong { color: var(--color-text-1); }
  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.blocked-text {
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 767px) {
  .page-header,
  .header-main {
    flex-direction: column;
  }

  .page-header {
    padding: 16px;
  }
}
</style>
