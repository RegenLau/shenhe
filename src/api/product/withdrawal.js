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
