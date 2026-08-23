import { request } from '@/utils/request.js'

export default {
  getMonthlySummary() {
    return request({
      url: '/core/product/settlement/summary',
      method: 'get'
    })
  },

  getMonthlyJobList(params = {}) {
    return request({
      url: '/core/product/settlement/job/index',
      method: 'get',
      params
    })
  },

  getCycleList(params = {}) {
    return request({
      url: '/core/product/settlement/cycle/index',
      method: 'get',
      params
    })
  },

  getSettlementHistory(params = {}) {
    return request({
      url: '/core/product/settlement/history/index',
      method: 'get',
      params
    })
  },

  readCycle(id) {
    return request({
      url: '/core/product/settlement/cycle/read',
      method: 'get',
      params: { id }
    })
  },

  runCycle(month) {
    return request({
      url: '/core/product/settlement/cycle/run',
      method: 'post',
      data: { month }
    })
  },

  readMonthlyOrder(id) {
    return request({
      url: '/core/product/settlement/order/read',
      method: 'get',
      params: { id }
    })
  },

  getPaymentAccount(doctorId) {
    return request({
      url: '/core/product/settlement/paymentAccount',
      method: 'get',
      params: { doctor_id: doctorId }
    })
  },

  savePaymentAccount(data = {}) {
    return request({
      url: '/core/product/settlement/paymentAccount',
      method: 'put',
      data
    })
  },

  createManualOrder(data = {}) {
    return request({
      url: '/core/product/settlement/order/manual',
      method: 'post',
      data
    })
  },

  getManualCandidates(params = {}) {
    return request({
      url: '/core/product/settlement/manual/candidates',
      method: 'get',
      params
    })
  },

  createMonthlyExport(data = {}) {
    return request({
      url: '/core/product/settlement/export/create',
      method: 'post',
      data
    })
  },

  createManualExport(orderId) {
    return request({
      url: '/core/product/settlement/export/create',
      method: 'post',
      data: { order_ids: [orderId] }
    })
  },

  downloadMonthlyExport(url) {
    return request({
      url,
      method: 'get',
      responseType: 'blob'
    })
  },

  previewMonthlyResultImport(data = {}) {
    return request({
      url: '/core/product/settlement/resultImportPreview',
      method: 'post',
      data
    })
  },

  confirmMonthlyResultImport(previewId) {
    return request({
      url: '/core/product/settlement/resultImportConfirm',
      method: 'post',
      data: { preview_id: previewId }
    })
  },

  markMonthlyOrderPaid(data = {}) {
    return request({
      url: '/core/product/settlement/order/markPaid',
      method: 'post',
      data
    })
  },

  getDoctorMonthlyOverview(doctorId) {
    return request({
      url: '/core/product/settlement/doctor/overview',
      method: 'get',
      params: { doctor_id: doctorId }
    })
  },

  getSummary() {
    return request({
      url: '/core/product/withdrawal/summary',
      method: 'get'
    })
  },

  getPageList(params = {}) {
    return request({
      url: '/core/product/withdrawal/index',
      method: 'get',
      params
    })
  },

  getBatchList(params = {}) {
    return request({
      url: '/core/product/withdrawal/batch/index',
      method: 'get',
      params
    })
  },

  readBatch(batchNo) {
    return request({
      url: '/core/product/withdrawal/batch/read',
      method: 'get',
      params: { batch_no: batchNo }
    })
  },

  read(id) {
    return request({
      url: '/core/product/withdrawal/read',
      method: 'get',
      params: { id }
    })
  },

  exportPending() {
    return request({
      url: '/core/product/withdrawal/export',
      method: 'post',
      data: {},
      responseType: 'blob'
    })
  },

  exportBatch(batchNo) {
    return request({
      url: '/core/product/withdrawal/export',
      method: 'post',
      data: { batch_no: batchNo },
      responseType: 'blob'
    })
  },

  exportBatchReviewRecords(batchNo) {
    return request({
      url: '/core/product/withdrawal/exportReviewRecords',
      method: 'post',
      data: { batch_no: batchNo },
      responseType: 'blob'
    })
  },

  previewSettlementImport(data = {}) {
    return request({
      url: '/core/product/withdrawal/settlementImportPreview',
      method: 'post',
      data
    })
  },

  confirmSettlementImport(previewId) {
    return request({
      url: '/core/product/withdrawal/settlementImportConfirm',
      method: 'post',
      data: { preview_id: previewId }
    })
  }
}
