import { request } from '@/utils/request.js'

export default {
  getPageList(params = {}) {
    return request({
      url: '/core/product/doctor-certification/index',
      method: 'get',
      params
    })
  },

  read(id) {
    return request({
      url: '/core/product/doctor-certification/read',
      method: 'get',
      params: { id }
    })
  },

  review(data = {}) {
    return request({
      url: '/core/product/doctor-certification/review',
      method: 'post',
      data
    })
  }
}