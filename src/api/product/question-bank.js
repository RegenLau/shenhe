import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/question-bank/index',
      method: 'get',
      params
    })
  },

  read(id) {
    return request({
      url: '/core/product/question-bank/read',
      method: 'get',
      params: { id }
    })
  },

  getStandards() {
    return request({
      url: '/core/product/question-bank/standards',
      method: 'get'
    })
  },

  getDrugOptions(keyword = '') {
    return request({
      url: '/core/product/question-bank/drugOptions',
      method: 'get',
      params: { keyword }
    })
  },

  save(data = {}) {
    return request({
      url: '/core/product/question-bank/save',
      method: 'post',
      data
    })
  },

  update(id, data = {}) {
    return request({
      url: '/core/product/question-bank/update',
      method: 'put',
      params: { id },
      data
    })
  },

  changeStatus(data = {}) {
    return request({
      url: '/core/product/question-bank/changeStatus',
      method: 'post',
      data
    })
  }
}
