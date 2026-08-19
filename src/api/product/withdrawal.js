import { request } from '@/utils/request.js'

export default {
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
