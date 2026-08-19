import { request } from '@/utils/request.js'

export default {
  tree() {
    return request({
      url: '/core/product/project-org/tree',
      method: 'get'
    })
  },

  getPageList(params = {}) {
    return request({
      url: '/core/product/project-org/index',
      method: 'get',
      params
    })
  },

  save(data = {}) {
    return request({
      url: '/core/product/project-org/save',
      method: 'post',
      data
    })
  },

  update(id, data = {}) {
    return request({
      url: '/core/product/project-org/update',
      method: 'put',
      params: { id },
      data
    })
  },

  destroy(data = {}) {
    return request({
      url: '/core/product/project-org/destroy',
      method: 'delete',
      data
    })
  },

  changeStatus(data = {}) {
    return request({
      url: '/core/product/project-org/changeStatus',
      method: 'post',
      data
    })
  }
}
