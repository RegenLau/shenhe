<template>
  <a-drawer
    v-model:visible="visible"
    width="min(720px, 100vw)"
    :title="title"
    :mask-closable="false"
    :esc-to-close="!loading"
    :closable="!loading"
    :on-before-cancel="beforeCancel"
    unmount-on-close
  >
    <a-spin :loading="initialLoading" class="form-loading">
      <a-result
        v-if="!initialLoading && loadError"
        status="error"
        title="题目编辑内容加载失败"
        :subtitle="loadError"
      >
        <template #extra>
          <a-button type="primary" @click="retryLoad">重新加载</a-button>
        </template>
      </a-result>

      <a-form
        v-else-if="ready"
        ref="formRef"
        :model="formData"
        :rules="rules"
        layout="vertical"
        scroll-to-first-error
      >
        <a-alert v-if="submitError" type="error" show-icon class="submit-error">
          {{ submitError }}
          <template #action>
            <a-button size="small" @click="submitError = ''">关闭</a-button>
          </template>
        </a-alert>

        <section class="form-section">
          <h3>药品与问题</h3>
          <a-form-item
            field="drug_id"
            label="关联药品"
            extra="药品信息来自 AI 数智人药师药品库，选择后不可在题库中修改"
          >
            <a-select
              v-model="formData.drug_id"
              :loading="drugOptionsLoading"
              :filter-option="false"
              :search-delay="300"
              allow-search
              allow-clear
              placeholder="输入药品名称、规格或厂家检索"
              @search="loadDrugOptions"
              @change="handleDrugChange"
              @popup-visible-change="handleDrugPopupVisible"
            >
              <a-option
                v-for="drug in selectableDrugOptions"
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

          <div v-if="selectedDrug" class="selected-drug-card">
            <div class="drug-image-preview">
              <a-image
                v-if="drugImagePreview"
                :src="drugImagePreview"
                :alt="`${formData.drug_name || '药品'}图片预览`"
                width="96"
                height="96"
                fit="cover"
              >
                <template #error><span class="image-error-text">图片不可用</span></template>
              </a-image>
              <div v-else class="drug-image-placeholder">暂无图片</div>
            </div>
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="药品名称">
                {{ selectedDrug.name || '—' }}
              </a-descriptions-item>
              <a-descriptions-item label="药品规格">
                {{ selectedDrug.spec || '—' }}
              </a-descriptions-item>
              <a-descriptions-item label="生产厂家">
                {{ selectedDrug.manufacturer || '—' }}
              </a-descriptions-item>
              <a-descriptions-item label="药品分类">
                {{ selectedDrug.type || '—' }}
              </a-descriptions-item>
            </a-descriptions>
          </div>

          <a-form-item field="question" label="审核问题">
            <a-textarea
              v-model="formData.question"
              placeholder="请输入需要医生审核的完整问题"
              :max-length="2000"
              show-word-limit
              :auto-size="{ minRows: 4, maxRows: 10 }"
            />
          </a-form-item>

          <a-row :gutter="[16, 0]">
            <a-col :xs="24" :sm="12">
              <a-form-item field="type_code" label="问题类型">
                <a-select
                  v-model="formData.type_code"
                  :options="questionTypeOptions"
                  placeholder="请选择问题类型"
                  allow-clear
                  @change="handleTypeChange"
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item field="disease_type" label="疾病分类">
                <a-input
                  v-model="formData.disease_type"
                  placeholder="选填，请输入疾病分类"
                  :max-length="100"
                  allow-clear
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item
                field="department"
                label="科室归属"
                extra="选项来自医院端配置中已启用的科室"
              >
                <a-select
                  v-model="formData.department"
                  :options="departmentOptions"
                  placeholder="选填，请选择科室归属"
                  allow-search
                  allow-clear
                />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section">
          <h3>AI 回答</h3>
          <a-form-item field="answer" label="回答内容">
            <a-textarea
              v-model="formData.answer"
              placeholder="请输入完整 AI 回答"
              :max-length="3000"
              show-word-limit
              :auto-size="{ minRows: 6, maxRows: 14 }"
            />
          </a-form-item>
        </section>

        <section class="form-section">
          <h3>风险与来源</h3>
          <a-form-item field="risk_tags" label="风险标签">
            <div class="risk-tag-content">
              <a-select
                v-if="riskTagOptions.length"
                v-model="formData.risk_tags"
                :options="riskTagOptions"
                :format-label="formatRiskTagLabel"
                placeholder="请选择题目实际命中的风险标签"
                multiple
                allow-search
                allow-clear
              />
              <a-empty v-else description="暂无可选风险规则" />
              <div v-if="riskRuleGuidance.length" class="risk-guidance-list">
                <div v-for="rule in riskRuleGuidance" :key="rule.key">
                  <strong>{{ rule.label }}</strong>
                  <p>{{ rule.description }}</p>
                </div>
              </div>
            </div>
          </a-form-item>

          <a-form-item field="source_reference" label="来源依据">
            <a-textarea
              v-model="formData.source_reference"
              placeholder="请记录指南、说明书、文献或内部知识库依据"
              :max-length="2000"
              show-word-limit
              :auto-size="{ minRows: 3, maxRows: 8 }"
            />
          </a-form-item>
        </section>

        <section class="form-section">
          <h3>系统计算结果</h3>
          <a-alert type="info" show-icon class="calculation-tip">
            基础等级、最终等级和单条积分均由服务端按定价与风险规则计算，此处不可手工修改。
          </a-alert>
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="基础等级">
              <sa-dict
                v-if="formData.base_level"
                :value="formData.base_level"
                dict="question_level"
              />
              <span v-else>保存后计算</span>
            </a-descriptions-item>
            <a-descriptions-item label="最终等级">
              <sa-dict
                v-if="formData.final_level"
                :value="formData.final_level"
                dict="question_level"
              />
              <span v-else>保存后计算</span>
            </a-descriptions-item>
            <a-descriptions-item label="单条积分">
              <strong class="reward-text">{{ formatReward(formData.unit_reward_cent) }}</strong>
            </a-descriptions-item>
            <a-descriptions-item label="题库状态">
              <sa-dict
                :value="formData.lifecycle_status"
                dict="question_lifecycle_status"
                render="span"
              />
            </a-descriptions-item>
          </a-descriptions>
        </section>
      </a-form>
    </a-spin>

    <template #footer>
      <a-space>
        <a-button :disabled="loading" @click="requestClose">取消</a-button>
        <a-button
          type="primary"
          :loading="loading"
          :disabled="!ready || Boolean(loadError)"
          @click="submit"
        >
          {{ mode === 'add' ? '新增题目' : '保存题目' }}
        </a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import questionBankApi from '@/api/product/question-bank'

const emit = defineEmits(['success'])
const formRef = ref()
const visible = ref(false)
const mode = ref('add')
const loading = ref(false)
const initialLoading = ref(false)
const ready = ref(false)
const loadError = ref('')
const submitError = ref('')
const currentId = ref()
const suppliedStandards = ref()
const originalSnapshot = ref('')
const originalDepartment = ref('')
const discardConfirmOpen = ref(false)
const drugOptions = ref([])
const drugOptionsLoading = ref(false)
const drugOptionsError = ref('')
let drugOptionsRequestId = 0

const standards = reactive({
  pricing: [],
  risk_rules: [],
  question_types: [],
  risk_tag_labels: {},
  department_options: [],
  summary: {}
})

const createInitialForm = () => ({
  id: undefined,
  question_no: '',
  drug_id: undefined,
  type_code: '',
  type_name: '',
  drug_image_url: '',
  drug_name: '',
  drug_specification: '',
  drug_manufacturer: '',
  drug_type: '',
  disease_type: '',
  department: '',
  question: '',
  answer: '',
  risk_tags: [],
  base_level: '',
  final_level: '',
  unit_reward_cent: undefined,
  source_reference: '',
  lifecycle_status: 'draft'
})

const formData = reactive(createInitialForm())

const drugImagePreview = computed(() => String(formData.drug_image_url || '').trim())
const selectedDrug = computed(() => {
  if (formData.drug_id === undefined || formData.drug_id === null || formData.drug_id === '') {
    return null
  }
  return {
    drug_id: formData.drug_id,
    image: formData.drug_image_url,
    name: formData.drug_name,
    spec: formData.drug_specification,
    manufacturer: formData.drug_manufacturer,
    type: formData.drug_type
  }
})

const selectableDrugOptions = computed(() => {
  const options = [...drugOptions.value]
  const selected = selectedDrug.value
  if (
    selected &&
    !options.some((item) => String(item.drug_id) === String(selected.drug_id))
  ) {
    options.unshift(selected)
  }
  return options
})

const title = computed(() =>
  mode.value === 'add'
    ? '新增题目'
    : `编辑题目${formData.question_no ? ` · ${formData.question_no}` : ''}`
)

const normalizeOptions = (source = []) => {
  if (Array.isArray(source)) {
    return source.map((item, index) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { label: String(item), value: String(item), description: '' }
      }
      const value = item.value ?? item.code ?? item.type_code ?? item.tag ?? item.id ?? index
      return {
        value: String(value),
        label: String(item.label ?? item.name ?? item.type_name ?? String(value)),
        description: String(
          item.description ?? item.rule ?? item.trigger ?? item.upgrade_reason ?? ''
        )
      }
    })
  }

  return Object.entries(source || {}).map(([value, item]) => ({
    value: String(value),
    label: String(item?.label ?? item?.name ?? item),
    description: String(item?.description ?? item?.rule ?? '')
  }))
}

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

const questionTypeRecords = computed(() => {
  const source = Array.isArray(standards.question_types)
    ? standards.question_types
    : Object.entries(standards.question_types || {}).map(([code, item]) => ({
        ...(item && typeof item === 'object' ? item : { name: item }),
        code
      }))

  return source.map((item, index) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return {
        value: String(item),
        label: String(item),
        defaultRiskTags: []
      }
    }
    const value = item.value ?? item.code ?? item.type_code ?? item.id ?? index
    const defaultRiskTags = item.default_risk_tags ?? item.risk_tags ?? []
    return {
      ...item,
      value: String(value),
      label: String(item.label ?? item.name ?? item.type_name ?? value),
      defaultRiskTags: (Array.isArray(defaultRiskTags)
        ? defaultRiskTags
        : [defaultRiskTags]
      )
        .filter(Boolean)
        .map(String)
    }
  })
})

const questionTypeOptions = computed(() => {
  const options = questionTypeRecords.value.map((item) => ({
    label: item.label,
    value: item.value
  }))
  if (
    formData.type_code &&
    !options.some((item) => item.value === String(formData.type_code))
  ) {
    options.push({
      value: String(formData.type_code),
      label: formData.type_name || String(formData.type_code),
      description: ''
    })
  }
  return options
})

const enabledDepartmentOptions = computed(() => normalizeOptions(standards.department_options))
const riskTagLabelMap = computed(() => normalizeRiskTagLabels(standards.risk_tag_labels))
const riskTagLabel = (tag) => {
  const label = riskTagLabelMap.value[String(tag)]
  return isChineseDisplay(label) ? label : '其他风险标签'
}
const formatRiskTagLabel = (option) => riskTagLabel(option?.value)
const riskRuleLabel = (rule) =>
  isChineseDisplay(rule?.label) ? rule.label : '风险升级规则'
const departmentOptions = computed(() => {
  const options = [...enabledDepartmentOptions.value]
  if (
    mode.value === 'edit' &&
    originalDepartment.value &&
    !options.some((item) => item.value === originalDepartment.value)
  ) {
    options.push({
      label: `${originalDepartment.value}（历史值）`,
      value: originalDepartment.value,
      disabled: true
    })
  }
  return options
})

const normalizedRiskRules = computed(() => {
  const source = Array.isArray(standards.risk_rules)
    ? standards.risk_rules
    : Array.isArray(standards.risk_rules?.rules)
      ? standards.risk_rules.rules
      : Object.entries(standards.risk_rules || {}).map(([tag, item]) => ({
          ...(item && typeof item === 'object' ? item : { min_level: item }),
          tags: [tag]
        }))

  return source.map((rule, index) => {
    const tags = rule.tags ?? rule.risk_tags ?? rule.tag ?? rule.risk_tag ?? []
    return {
      ...rule,
      key: String(rule.id ?? rule.code ?? index),
      label: String(rule.label ?? rule.name ?? `风险规则 ${index + 1}`),
      description: String(rule.description ?? rule.reason ?? ''),
      minLevel: rule.min_level ?? rule.target_level ?? rule.upgrade_to ?? '',
      tags: [
        ...(Array.isArray(tags) ? tags : [tags]),
        ...Object.keys(rule.tag_levels || {})
      ]
        .filter(Boolean)
        .map(String)
        .filter((tag, tagIndex, all) => all.indexOf(tag) === tagIndex)
    }
  })
})

const selectedTypeDefaultTags = computed(() => {
  return (
    questionTypeRecords.value.find((item) => item.value === String(formData.type_code))
      ?.defaultRiskTags || []
  )
})

const riskTagOptions = computed(() => {
  const options = new Map()
  normalizedRiskRules.value.forEach((rule) => {
    rule.tags.forEach((tag) => {
      const levelText = rule.minLevel ? `，至少 ${rule.minLevel} 级` : ''
      options.set(tag, {
        value: tag,
        label: `${riskTagLabel(tag)} · ${riskRuleLabel(rule)}${levelText}`
      })
    })
  })

  ;[...selectedTypeDefaultTags.value, ...formData.risk_tags].forEach((tag) => {
    if (!options.has(tag)) {
      options.set(tag, { value: tag, label: riskTagLabel(tag) })
    }
  })
  return [...options.values()]
})

const riskRuleGuidance = computed(() =>
  normalizedRiskRules.value
    .filter((rule) => rule.description)
    .map((rule) => ({
      key: rule.key,
      label: rule.minLevel
        ? `${riskRuleLabel(rule)}（至少 ${rule.minLevel} 级）`
        : riskRuleLabel(rule),
      description: isChineseDisplay(rule.description)
        ? rule.description
        : '请根据风险规则核对题目内容。'
    }))
)

const handleTypeChange = (value) => {
  const record = questionTypeRecords.value.find((item) => item.value === String(value))
  formData.risk_tags = record ? [...record.defaultRiskTags] : []
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
  drugOptionsLoading.value = true
  drugOptionsError.value = ''
  try {
    const response = await questionBankApi.getDrugOptions(String(keyword || '').trim())
    if (requestId !== drugOptionsRequestId) return
    if (response.code !== 200) {
      drugOptionsError.value = response.message || '药品库检索失败'
      return
    }
    drugOptions.value = normalizeDrugOptions(response.data)
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

const handleDrugChange = (value) => {
  if (value === undefined || value === null || value === '') {
    Object.assign(formData, {
      drug_id: undefined,
      drug_image_url: '',
      drug_name: '',
      drug_specification: '',
      drug_manufacturer: '',
      drug_type: ''
    })
    return
  }

  const drug = selectableDrugOptions.value.find(
    (item) => String(item.drug_id) === String(value)
  )
  if (!drug) return
  Object.assign(formData, {
    drug_id: String(drug.drug_id),
    drug_image_url: drug.image,
    drug_name: drug.name,
    drug_specification: drug.spec,
    drug_manufacturer: drug.manufacturer,
    drug_type: drug.type
  })
}

const rules = {
  drug_id: [{ required: true, message: '请从药品库选择药品' }],
  type_code: [{ required: true, message: '请选择问题类型' }],
  disease_type: [{ maxLength: 100, message: '疾病分类不能超过 100 个字符' }],
  department: [
    {
      validator: (value, callback) => {
        if (
          !value ||
          enabledDepartmentOptions.value.some((item) => item.value === String(value)) ||
          (mode.value === 'edit' && String(value) === originalDepartment.value)
        ) {
          callback()
          return
        }
        callback('请选择医院端配置中已启用的科室')
      }
    }
  ],
  question: [
    { required: true, message: '请输入审核问题' },
    { maxLength: 2000, message: '审核问题不能超过 2000 个字符' }
  ],
  answer: [
    { required: true, message: '请输入 AI 回答' },
    { maxLength: 3000, message: 'AI 回答不能超过 3000 个字符' }
  ],
  source_reference: [
    { required: true, message: '请填写来源依据' },
    { maxLength: 2000, message: '来源依据不能超过 2000 个字符' }
  ]
}

const serializeEditableForm = () =>
  JSON.stringify({
    drug_id: formData.drug_id,
    type_code: formData.type_code,
    disease_type: formData.disease_type,
    department: formData.department,
    question: formData.question,
    answer: formData.answer,
    risk_tags: [...formData.risk_tags],
    source_reference: formData.source_reference
  })

const isDirty = computed(
  () => ready.value && serializeEditableForm() !== originalSnapshot.value
)

const setStandards = (value = {}) => {
  Object.assign(standards, {
    pricing: value.pricing || [],
    risk_rules: value.risk_rules || [],
    question_types: value.question_types || [],
    risk_tag_labels: value.risk_tag_labels || {},
    department_options: value.department_options || [],
    summary: value.summary || {}
  })
}

const loadStandards = async (provided) => {
  if (
    provided &&
    (normalizeOptions(provided.question_types).length ||
      normalizeOptions(provided.risk_rules).length ||
      Object.keys(provided.pricing || {}).length)
  ) {
    setStandards(provided)
    return true
  }

  const response = await questionBankApi.getStandards()
  if (response.code !== 200 || !response.data) {
    loadError.value = response.message || '分级定价标准加载失败'
    return false
  }
  setStandards(response.data)
  return true
}

const sourceReferenceText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join('\n')
  }
  return JSON.stringify(value, null, 2)
}

const answerText = (value) => {
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
}

const hydrateForm = (record = {}) => {
  const initial = createInitialForm()

  Object.assign(formData, initial, {
    id: record.id,
    question_no: record.question_no || '',
    drug_id:
      record.drug_id === undefined || record.drug_id === null
        ? undefined
        : String(record.drug_id),
    type_code: record.type_code === undefined ? '' : String(record.type_code),
    type_name: record.type_name || '',
    drug_image_url: record.drug_image_url || record.drug_image || record.image_url || '',
    drug_name: record.drug_name || '',
    drug_specification: record.drug_specification || record.specification || '',
    drug_manufacturer: record.drug_manufacturer || '',
    drug_type: record.drug_type || '',
    disease_type: record.disease_type || '',
    department: record.department || '',
    question: record.question || '',
    answer: answerText(record.answer),
    risk_tags: Array.isArray(record.risk_tags)
      ? record.risk_tags.map((item) => String(item))
      : [],
    base_level: record.base_level || '',
    final_level: record.final_level || '',
    unit_reward_cent: record.unit_reward_cent,
    source_reference: sourceReferenceText(record.source_reference),
    lifecycle_status: record.lifecycle_status || 'draft'
  })
}

const loadInitial = async (provided) => {
  initialLoading.value = true
  ready.value = false
  loadError.value = ''
  submitError.value = ''
  originalDepartment.value = ''
  hydrateForm()

  try {
    const standardsReady = await loadStandards(provided)
    if (!standardsReady) return

    if (mode.value === 'edit') {
      const response = await questionBankApi.read(currentId.value)
      if (response.code !== 200 || !response.data) {
        loadError.value = response.message || '题目详情加载失败'
        return
      }
      hydrateForm(response.data)
      originalDepartment.value = String(formData.department || '')
    }

    await loadDrugOptions('')

    ready.value = true
    await nextTick()
    formRef.value?.clearValidate()
    originalSnapshot.value = serializeEditableForm()
  } catch {
    loadError.value = '编辑内容加载失败，请检查网络后重试'
  } finally {
    initialLoading.value = false
  }
}

const open = async (openMode = 'add', record = null, provided = null) => {
  mode.value = openMode
  currentId.value = record?.id
  suppliedStandards.value = provided
  loading.value = false
  discardConfirmOpen.value = false
  visible.value = true
  await loadInitial(provided)
}

const retryLoad = () => loadInitial(suppliedStandards.value)

const trimValue = (value) => String(value || '').trim()

const buildPayload = () => ({
  drug_id: formData.drug_id,
  type_code: formData.type_code,
  disease_type: trimValue(formData.disease_type),
  department: trimValue(formData.department),
  question: trimValue(formData.question),
  answer: {
    suggestion: trimValue(formData.answer)
  },
  risk_tags: [...formData.risk_tags],
  source_reference: trimValue(formData.source_reference)
})

const submit = async () => {
  const errors = await formRef.value?.validate()
  if (errors) return

  loading.value = true
  submitError.value = ''
  try {
    const payload = buildPayload()
    const response =
      mode.value === 'add'
        ? await questionBankApi.save(payload)
        : await questionBankApi.update(currentId.value, payload)

    if (response.code !== 200) {
      submitError.value = `${response.message || '题目保存失败'}。已保留当前填写内容，请核对后重试。`
      return
    }

    Message.success(mode.value === 'add' ? '题目新增成功' : '题目保存成功')
    originalSnapshot.value = serializeEditableForm()
    emit('success', response.data)
    visible.value = false
  } catch {
    submitError.value = '题目保存失败，请检查网络后重试。已保留当前填写内容。'
  } finally {
    loading.value = false
  }
}

const showDiscardConfirm = () => {
  if (discardConfirmOpen.value) return
  discardConfirmOpen.value = true
  Modal.confirm({
    title: '放弃未保存修改？',
    content: '关闭后，当前题目中尚未保存的内容将丢失。',
    width: 'min(420px, calc(100vw - 32px))',
    okText: '放弃修改',
    okButtonProps: { status: 'danger' },
    onOk: () => {
      discardConfirmOpen.value = false
      originalSnapshot.value = serializeEditableForm()
      visible.value = false
    },
    onCancel: () => {
      discardConfirmOpen.value = false
    }
  })
}

const beforeCancel = () => {
  if (loading.value || initialLoading.value) return false
  if (!isDirty.value) return true
  showDiscardConfirm()
  return false
}

const requestClose = () => {
  if (beforeCancel()) visible.value = false
}

const formatReward = (value) => {
  const number = Number(value)
  if (value === undefined || value === null || !Number.isFinite(number)) {
    return '保存后计算'
  }
  return `${(number / 100).toLocaleString('zh-CN')} 积分 / 条`
}

defineExpose({ open })
</script>

<style scoped lang="less">
.form-loading {
  display: block;
  width: 100%;
  min-height: 480px;
}

.submit-error {
  margin-bottom: 20px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-1);

  &:last-child {
    margin-bottom: 0;
    border-bottom: none;
  }

  h3 {
    margin: 0 0 16px;
    color: var(--color-text-1);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
}

.selected-drug-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: stretch;
  gap: 16px;
  width: 100%;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: var(--border-radius-medium);

  :deep(.arco-descriptions) {
    min-width: 0;
  }
}

.drug-image-preview {
  display: flex;
  width: 96px;
  height: 96px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--border-radius-medium);
}

.drug-image-placeholder {
  display: flex;
  width: 96px;
  height: 96px;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
  font-size: 12px;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-2);
  border-radius: var(--border-radius-medium);
}

.image-error-text {
  color: var(--color-text-3);
  font-size: 12px;
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

.risk-tag-content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.risk-guidance-list {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;

  div {
    padding: 12px;
    background: var(--color-fill-1);
    border-radius: var(--border-radius-medium);
  }

  strong {
    color: var(--color-text-1);
    font-size: 13px;
    font-weight: 500;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-text-3);
    font-size: 12px;
    line-height: 20px;
  }
}

.calculation-tip {
  margin-bottom: 16px;
}

.reward-text {
  color: rgb(var(--primary-6));
}

@media (max-width: 575px) {
  .selected-drug-card {
    grid-template-columns: 1fr;
  }
}
</style>
