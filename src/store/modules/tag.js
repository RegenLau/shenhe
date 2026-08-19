import { defineStore } from 'pinia'
import tool from '@/utils/tool'

const defaultTag = [ { name: 'dashboard', title: '工作台', path: '/dashboard', affix: true } ]
const useTagStore = defineStore('tag', {
  state: () => ({
    tags: (! tool.local.get('tags') || tool.local.get('tags').length === 0 ) ? defaultTag : tool.local.get('tags')
  }),

  getters: {
    getState() {
      return { ...this.$state }
    },
  },

  actions: {

    addTag(tag) {
      const target = this.tags.find( item => item.path === tag.path )
      if (! target && tag.path ) {
        this.tags.push(tag)
      } else if (target && tag.title && !target.customTitle) {
        // 菜单名称变更后，同一路由的已打开标签也要同步更新
        target.title = tag.title
      }
      this.updateTagsToLocal()
    },

    removeTag(tag) {
      let index = 0
      this.tags.map((item, idx) => {
        if ( item.path === tag.path && ! item.affix ) {
          if (this.tags[(idx + 1)]) {
            index = idx
          } else if ( idx > 0) {
            index = idx - 1
          }
          this.tags.splice(idx, 1)
        }
      })
      this.updateTagsToLocal()
      return this.tags[index]
    },

    updateTag(tag) {
      this.tags.map(item => {
        if (item.path == tag.path) {
          item = Object.assign(item, tag)
        }
      })
      this.updateTagsToLocal()
    },

    updateTagTitle(path, title) {
      this.tags.map(item => {
        if (item.path == path) {
          item.customTitle = title
        }
      })
      this.updateTagsToLocal()
    },

    syncTitles(routers = []) {
      const titles = new Map()
      const collect = (items) => {
        items.forEach((item) => {
          if (item.name && item.meta?.title) {
            titles.set(item.name, item.meta.title)
          }
          if (item.children?.length) collect(item.children)
        })
      }
      collect(routers)
      this.tags.forEach((tag) => {
        const title = titles.get(tag.name)
        if (title && !tag.customTitle) tag.title = title
      })
      this.updateTagsToLocal()
    },

    updateTagsToLocal() {
      tool.local.set('tags', this.tags)
    },

    clearTags() {
      this.tags = defaultTag
      tool.local.set('tags', defaultTag)
    },
  },
})

export default useTagStore
