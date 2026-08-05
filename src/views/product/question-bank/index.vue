<template>
  <div class="question-bank-page">
    <header class="page-header">
      <div>
        <div class="page-title-row">
          <h1>审核题库</h1>
          <a-tooltip content="查看任务档位说明">
            <a-button
              type="text"
              shape="circle"
              class="pricing-explain-button"
              aria-label="查看任务档位说明"
              @click="pricingModalVisible = true"
            >
              <template #icon><icon-info-circle /></template>
            </a-button>
          </a-tooltip>
        </div>
        <p>以药品为主线维护 AI 药学问答，并查看题库可用情况</p>
      </div>
    </header>

    <a-alert v-if="standardsError" type="warning" show-icon>
      {{ standardsError }}
      <template #action>
        <a-button size="small" :loading="standardsLoading" @click="loadStandards">
          重新加载
        </a-button>
      </template>
    </a-alert>

    <a-spin :loading="standardsLoading" class="summary-loading">
      <a-card title="题库库存" :bordered="false" class="summary-card">
        <div class="inventory-grid">
          <div v-for="metric in inventoryMetrics" :key="metric.key" class="inventory-item">
            <span>{{ metric.label }}</span>
            <strong>{{ formatSummaryValue(metric.value) }}</strong>
            <small>{{ metric.unit || '条' }}</small>
          </div>
        </div>
      </a-card>
    </a-spin>

    <a-modal
      v-model:visible="pricingModalVisible"
      title="任务档位说明"
      :footer="false"
      :width="520"
      unmount-on-close
    >
      <p class="pricing-modal-intro">
        系统根据问题类型和风险规则计算最终档位，创建任务时按对应积分计入医生任务额度。
      </p>
      <div class="pricing-modal-list">
        <div v-for="item in pricingDisplayRows" :key="item.value" class="pricing-modal-item">
          <a-tag :color="levelColor(item.value)">{{ item.label }}</a-tag>
          <div>
            <strong>{{ formatReward(item.unit_reward_cent) }}</strong>
            <p>{{ levelDescription(item.value) }}</p>
          </div>
        </div>
      </div>
    </a-modal>

    <a-alert v-if="actionError" type="error" show-icon>
      {{ actionError }}
      <template #action>
        <a-button size="small" @click="actionError = ''">关闭</a-button>
      </template>
    </a-alert>

    <a-alert v-if="tableError" type="error" show-icon>
      {{ tableError }}
      <template #action>
        <a-button size="small" @click="refresh">重新加载</a-button>
      </template>
    </a-alert>

    <sa-table
      v-show="!tableError"
      ref="crudRef"
      :options="options"
      :columns="columns"
      :search-form="searchForm"
      class="question-bank-table"
      @reset-search="resetSearchForm"
    >
      <template #tableSearch>
        <a-col :xs="24" :sm="8">
          <a-form-item field="drug_id" label="药品检索">
            <a-select
              v-model="searchForm.drug_id"
              :loading="drugOptionsLoading"
              :filter-option="false"
              :search-delay="300"
              allow-search
              allow-clear
              placeholder="按药品名称、规格或厂家检索"
              @search="loadDrugOptions"
              @popup-visible-change="handleDrugPopupVisible"
            >
              <a-option
                v-for="drug in drugOptions"
                :key="drug.drug_id"
                :value="String(drug.drug_id)"
                :label="`${drug.name} · ${drug.spec || '暂无规格'} · ${drug.manufacturer || '厂家待补充'}`"
              >
                <div class="drug-option-text">
                  <strong>{{ drug.name }}</strong>
                  <span>
                    {{ [drug.spec, drug.manufacturer, drug.type].filter(Boolean).join(' · ') || '暂无规格' }}
                  </span>
                </div>
              </a-option>
              <template #empty>
                <a-empty :description="drugOptionsError || '未找到匹配药品'" />
              </template>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="keyword" label="关键词">
            <a-input
              v-model="searchForm.keyword"
              placeholder="题目编号或问题内容"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="type_code" label="问题类型">
            <a-select
              v-model="searchForm.type_code"
              :options="questionTypeOptions"
              placeholder="全部类型"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="department" label="科室归属">
            <a-select
              v-model="searchForm.department"
              :options="departmentOptions"
              placeholder="全部科室"
              allow-search
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="final_level" label="任务档位">
            <sa-select
              v-model="searchForm.final_level"
              dict="question_level"
              placeholder="全部档位"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="8">
          <a-form-item field="lifecycle_status" label="题库状态">
            <sa-select
              v-model="searchForm.lifecycle_status"
              dict="question_lifecycle_status"
              placeholder="全部状态"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </template>

      <template #drug_image_url="{ record }">
        <div class="drug-image-cell">
          <a-image
            v-if="drugImageUrl(record)"
            :src="drugImageUrl(record)"
            :alt="`${record.drug_name || '药品'}图片`"
            width="56"
            height="56"
            fit="cover"
          >
            <template #error><span>图片不可用</span></template>
          </a-image>
          <span v-else>暂无图片</span>
        </div>
      </template>

      <template #drug_name="{ record }">
        <div class="drug-text-cell">
          <strong :title="record.drug_name">{{ record.drug_name || '—' }}</strong>
          <span v-if="record.drug_type" :title="record.drug_type">{{ record.drug_type }}</span>
        </div>
      </template>

      <template #drug_specification="{ record }">
        <span class="specification-cell" :title="drugSpecification(record)">
          {{ drugSpecification(record) }}
        </span>
      </template>

      <template #drug_manufacturer="{ record }">
        <span class="specification-cell" :title="record.drug_manufacturer || '—'">
          {{ record.drug_manufacturer || '—' }}
        </span>
      </template>

      <template #question="{ record }">
        <div class="question-cell">
          <strong :title="record.question">{{ record.question || '—' }}</strong>
          <span>{{ record.question_no || '题目编号待生成' }}</span>
        </div>
      </template>

      <template #type_info="{ record }">
        <div class="type-cell">
          <strong>{{ record.type_name || typeLabel(record.type_code) }}</strong>
          <span :title="typeSubtitle(record)">{{ typeSubtitle(record) }}</span>
        </div>
      </template>

      <template #final_level="{ record }">
        <sa-dict
          v-if="record.final_level"
          :value="record.final_level"
          dict="question_level"
        />
        <span v-else>待计算</span>
      </template>

      <template #unit_reward_cent="{ record }">
        <strong class="reward-cell">{{ formatReward(record.unit_reward_cent) }}</strong>
      </template>

      <template #lifecycle_status="{ record }">
        <sa-dict :value="record.lifecycle_status" dict="question_lifecycle_status" />
      </template>

      <template #operationCell="{ record }">
        <a-link @click="detailRef?.open(record.id, standards.risk_tag_labels)">查看</a-link>
        <a-link
          :disabled="changingId === record.id"
          @click="editRef?.open('edit', record, standards)"
        >
          编辑
        </a-link>
        <a-popconfirm
          :content="statusConfirmText(record)"
          position="bottom"
          @ok="changeStatus(record)"
        >
          <a-link
            :status="statusAction(record).danger ? 'danger' : 'normal'"
            :loading="changingId === record.id"
            :disabled="Boolean(changingId)"
          >
            {{ statusAction(record).label }}
          </a-link>
        </a-popconfirm>
      </template>
    </sa-table>

    <question-edit ref="editRef" @success="handleSaved" />
    <question-detail ref="detailRef" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import questionBankApi from '@/api/product/question-bank'
import QuestionEdit from './edit.vue'
import QuestionDetail from './view.vue'

const crudRef = ref()
const editRef = ref()
const detailRef = ref()
const tableError = ref('')
const actionError = ref('')
const changingId = ref()
const standardsLoading = ref(false)
const standardsError = ref('')
const pricingModalVisible = ref(false)
const drugOptions = ref([])
const drugOptionsLoading = ref(false)
const drugOptionsError = ref('')
let drugOptionsRequestId = 0
const standards = ref({
  pricing: [],
  risk_rules: [],
  question_types: [],
  risk_tag_labels: {},
  department_options: [],
  summary: {}
})

const searchForm = ref({
  drug_id: '',
  keyword: '',
  type_code: '',
  department: '',
  final_level: '',
  lifecycle_status: ''
})

const normalizeOptions = (source = []) => {
  if (Array.isArray(source)) {
    return source
      .map((item, index) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return { label: String(item), value: String(item) }
        }
        const value = item.value ?? item.code ?? item.type_code ?? item.id ?? index
        const label = item.label ?? item.name ?? item.type_name ?? String(value)
        return { label: String(label), value: String(value) }
      })
      .filter((item) => item.value !== '')
  }

  return Object.entries(source || {}).map(([value, item]) => ({
    value: String(value),
    label: String(item?.label ?? item?.name ?? item)
  }))
}

const normalizePricing = (pricing = {}) => {
  const source = pricing?.levels ?? pricing?.items ?? pricing?.level_prices ?? pricing
  const entries = Array.isArray(source)
    ? source.map((item, index) => [String(index), item])
    : Object.entries(source || {})

  return entries
    .map(([key, item]) => {
      if (typeof item === 'number') {
        return {
          value: key,
          label: `${key} 级`,
          unit_reward_cent: item
        }
      }
      if (!item || typeof item !== 'object') return null

      const value = item.final_level ?? item.level ?? item.code ?? item.value ?? key
      return {
        value: String(value),
        label: String(item.label ?? item.name ?? item.level_name ?? `${value} 级`),
        unit_reward_cent:
          item.unit_reward_cent ?? item.reward_cent ?? item.price_cent ?? item.amount_cent
      }
    })
    .filter(Boolean)
}

const questionTypeOptions = computed(() => normalizeOptions(standards.value.question_types))
const departmentOptions = computed(() => normalizeOptions(standards.value.department_options))
const pricingRows = computed(() => normalizePricing(standards.value.pricing))
const pricingDisplayRows = computed(() => {
  if (pricingRows.value.length) return pricingRows.value
  return [
    { value: 'A', label: 'A 级', unit_reward_cent: 10000 },
    { value: 'B', label: 'B 级', unit_reward_cent: 20000 },
    { value: 'C', label: 'C 级', unit_reward_cent: 30000 }
  ]
})

const getSummaryValue = (paths) => {
  const summary = standards.value.summary || {}
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], summary)
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

const inventoryMetrics = computed(() => {
  const total = getSummaryValue(['total_count', 'total', 'question_count', 'inventory.total'])
  const available = getSummaryValue([
    'available_count',
    'lifecycle_summary.available',
    'inventory.available_count'
  ])
  const explicitUnavailable = getSummaryValue([
    'unavailable_count',
    'inventory.unavailable_count'
  ])
  const unavailable = explicitUnavailable ?? (
    Number.isFinite(Number(total)) && Number.isFinite(Number(available))
      ? Math.max(Number(total) - Number(available), 0)
      : undefined
  )

  return [
    {
      key: 'drug',
      label: '药品数',
      unit: '种',
      value: getSummaryValue(['drug_count', 'drugs.total', 'inventory.drug_count'])
    },
    { key: 'total', label: '题目总数', value: total },
    { key: 'available', label: '可用题目', value: available },
    { key: 'unavailable', label: '暂不可分配', value: unavailable }
  ]
})

const formatSummaryValue = (value) => {
  const number = Number(value)
  return value === undefined || value === null || !Number.isFinite(number)
    ? '—'
    : number.toLocaleString('zh-CN')
}

const formatReward = (value) => {
  const number = Number(value)
  if (value === undefined || value === null || !Number.isFinite(number)) return '待计算'
  return `${(number / 100).toLocaleString('zh-CN')} 积分 / 条`
}

const levelColor = (level) => {
  if (String(level).toUpperCase() === 'A') return 'green'
  if (String(level).toUpperCase() === 'B') return 'orange'
  return 'red'
}

const levelDescription = (level) => {
  const descriptions = {
    A: '常规、边界清晰的基础用药问答',
    B: '需要结合多项临床条件判断的问答',
    C: '高风险、高警示或精确剂量等复杂问答'
  }
  return descriptions[String(level).toUpperCase()] || '由问题类型和风险规则确定'
}

const normalizeDrugOptions = (rows = []) => (
  Array.isArray(rows)
    ? rows
      .map((item) => ({
        drug_id: item?.drug_id,
        image: item?.image || item?.drug_image_url || '',
        name: String(item?.name || item?.drug_name || ''),
        spec: String(item?.spec || item?.drug_specification || ''),
        manufacturer: String(item?.drug_manufacturer || item?.manufacturer || ''),
        type: String(item?.type || item?.drug_type || '')
      }))
      .filter((item) => item.drug_id !== undefined && item.drug_id !== null && item.name)
    : []
)

const loadDrugOptions = async (keyword = '') => {
  const requestId = ++drugOptionsRequestId
  const selected = drugOptions.value.find(
    (item) => String(item.drug_id) === String(searchForm.value.drug_id)
  )
  drugOptionsLoading.value = true
  drugOptionsError.value = ''
  try {
    const response = await questionBankApi.getDrugOptions(String(keyword || '').trim())
    if (requestId !== drugOptionsRequestId) return
    if (response.code !== 200) {
      drugOptionsError.value = response.message || '药品库检索失败'
      return
    }
    const nextOptions = normalizeDrugOptions(response.data)
    if (
      selected &&
      !nextOptions.some((item) => String(item.drug_id) === String(selected.drug_id))
    ) {
      nextOptions.unshift(selected)
    }
    drugOptions.value = nextOptions
  } catch {
    if (requestId === drugOptionsRequestId) {
      drugOptionsError.value = '药品库检索失败，请稍后重试'
    }
  } finally {
    if (requestId === drugOptionsRequestId) drugOptionsLoading.value = false
  }
}

const handleDrugPopupVisible = (visible) => {
  if (visible && !drugOptions.value.length && !drugOptionsLoading.value) {
    loadDrugOptions('')
  }
}

const drugImageUrl = (record = {}) =>
  record.drug_image_url || record.drug_image || record.image_url || ''

const drugSpecification = (record = {}) =>
  record.drug_specification || record.specification || '—'

const typeLabel = (value) => {
  return questionTypeOptions.value.find((item) => item.value === String(value))?.label || value || '—'
}

const typeSubtitle = (record) =>
  [record.disease_type, record.department].filter(Boolean).join(' · ') || '未补充疾病分类或科室归属'

const statusAction = (record) => {
  if (record.lifecycle_status === 'available') {
    return { label: '停用', status: 'disabled', danger: true }
  }
  return {
    label: record.lifecycle_status === 'disabled' ? '重新启用' : '设为可分配',
    status: 'available',
    danger: false
  }
}

const statusConfirmText = (record) => {
  const action = statusAction(record)
  if (action.status === 'disabled') {
    return `停用后该题目不再进入新的审核任务，确定停用“${record.question_no || '该题目'}”吗？`
  }
  return `确定将“${record.question_no || '该题目'}”${action.label}吗？`
}

const loadList = async (params) => {
  try {
    const response = await questionBankApi.getPageList(params)
    if (response.code === 200) {
      tableError.value = ''
      return response
    }
    tableError.value = response.message || '审核题库加载失败，请重新加载'
  } catch {
    tableError.value = '审核题库加载失败，请检查网络后重试'
  }

  return {
    code: 200,
    message: 'fallback',
    data: { data: [], total: 0, current_page: 1, per_page: 10 }
  }
}

const loadStandards = async () => {
  if (standardsLoading.value) return
  standardsLoading.value = true
  standardsError.value = ''
  try {
    const response = await questionBankApi.getStandards()
    if (response.code === 200 && response.data) {
      standards.value = {
        pricing: response.data.pricing || [],
        risk_rules: response.data.risk_rules || [],
        question_types: response.data.question_types || [],
        risk_tag_labels: response.data.risk_tag_labels || {},
        department_options: response.data.department_options || [],
        summary: response.data.summary || {}
      }
      return
    }
    standardsError.value = response.message || '定价与库存摘要加载失败'
  } catch {
    standardsError.value = '定价与库存摘要加载失败，请检查网络后重试'
  } finally {
    standardsLoading.value = false
  }
}

const changeStatus = async (record) => {
  if (changingId.value) return
  const action = statusAction(record)
  changingId.value = record.id
  actionError.value = ''
  try {
    const response = await questionBankApi.changeStatus({
      id: record.id,
      status: action.status
    })
    if (response.code !== 200) {
      actionError.value = response.message || '题目状态更新失败，列表已保持原状态'
      return
    }
    Message.success(action.status === 'disabled' ? '题目已停用' : '题目已设为可分配')
    await Promise.all([refresh(), loadStandards()])
  } catch {
    actionError.value = '题目状态更新失败，请检查网络后重试'
  } finally {
    changingId.value = undefined
  }
}

const options = reactive({
  api: loadList,
  pageLayout: 'normal',
  showSort: false,
  operationColumnWidth: 240,
  add: {
    show: true,
    text: '新增题目',
    func: () => editRef.value?.open('add', null, standards.value)
  }
})

const columns = reactive([
  { title: '药品图片', dataIndex: 'drug_image_url', width: 88, fixed: 'left' },
  { title: '药品名称', dataIndex: 'drug_name', width: 160 },
  { title: '规格', dataIndex: 'drug_specification', width: 150 },
  { title: '生产厂家', dataIndex: 'drug_manufacturer', width: 190 },
  { title: '审核问题', dataIndex: 'question', width: 320 },
  { title: '任务档位', dataIndex: 'final_level', width: 105, align: 'center' },
  { title: '任务积分', dataIndex: 'unit_reward_cent', width: 120, align: 'right' },
  { title: '问题类型', dataIndex: 'type_info', width: 210 },
  { title: '题库状态', dataIndex: 'lifecycle_status', width: 105, align: 'center' },
  { title: '更新时间', dataIndex: 'update_time', width: 165 }
])

const refresh = () => crudRef.value?.refresh()

const resetSearchForm = () => {
  Object.assign(searchForm.value, {
    drug_id: '',
    keyword: '',
    type_code: '',
    department: '',
    final_level: '',
    lifecycle_status: ''
  })
}

const handleSaved = async () => {
  await Promise.all([refresh(), loadStandards()])
}

onMounted(() => {
  refresh()
  loadStandards()
  loadDrugOptions('')
})
</script>

<style scoped lang="less">
.question-bank-page {
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  gap: 12px;
}

.page-header {
  padding: 20px 24px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  h1 {
    margin: 0;
    color: var(--color-text-1);
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 14px;
    line-height: 20px;
  }
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pricing-explain-button {
  color: var(--color-text-3);

  &:hover,
  &:focus-visible {
    color: rgb(var(--primary-6));
  }
}

.summary-loading {
  display: block;
  min-height: 132px;
}

.summary-card {
  height: 100%;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  :deep(.arco-card-body) {
    min-height: 82px;
  }
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.inventory-item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  min-width: 0;
  padding: 12px;
  background: var(--color-fill-1);
  border-radius: var(--border-radius-medium);

  span {
    grid-column: 1 / -1;
    color: var(--color-text-3);
    font-size: 12px;
  }

  strong {
    margin-top: 4px;
    color: var(--color-text-1);
    font-size: 24px;
    line-height: 32px;
  }

  small {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.pricing-modal-intro {
  margin: 0 0 16px;
  color: var(--color-text-3);
  font-size: 14px;
  line-height: 22px;
}

.pricing-modal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pricing-modal-item {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-fill-1);
  border-radius: var(--border-radius-medium);

  strong {
    color: var(--color-text-1);
    font-size: 15px;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 13px;
    line-height: 20px;
  }
}

.question-bank-table {
  min-width: 0;
  max-width: 100%;
}

.drug-text-cell,
.question-cell,
.type-cell {
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

  strong {
    color: var(--color-text-1);
    font-size: 14px;
    font-weight: 500;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

.drug-image-cell {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  :deep(.arco-image) {
    display: block;
  }
}

.specification-cell {
  display: block;
  overflow: hidden;
  color: var(--color-text-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reward-cell {
  color: rgb(var(--primary-6));
  font-size: 14px;
  white-space: nowrap;
}

.drug-option-text {
  display: flex;
  min-width: 0;
  flex-direction: column;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--color-text-1);
    font-size: 14px;
    font-weight: 500;
  }

  span {
    color: var(--color-text-3);
    font-size: 12px;
  }
}

@media (max-width: 1199px) {
  .inventory-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 575px) {
  .page-header {
    padding: 16px;
  }

  .inventory-grid {
    grid-template-columns: 1fr;
  }

  .question-bank-table {
    :deep(.arco-card-body > div:first-child > .arco-row) {
      flex-direction: column;
      gap: 12px;
    }

    :deep(.arco-card-body > div:first-child > .arco-row > .arco-col) {
      width: 100%;
      flex: 0 0 100% !important;
      text-align: left !important;
    }

    :deep(.arco-pagination-options),
    :deep(.arco-pagination-jumper) {
      display: none;
    }

    :deep(.arco-pagination) {
      max-width: 100%;
      overflow-x: auto;
    }
  }
}
</style>
