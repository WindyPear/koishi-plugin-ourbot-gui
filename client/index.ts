import { Context } from '@koishijs/client'
import Qunconfig from './qunconfig.vue'

export default (ctx: Context) => {
  // 定义页面
  ctx.page({
    name: '群主配置',
    path: '/qun-config',
    component: Qunconfig,
  })

  // 定义菜单
  ctx.menu('qun-config', [
    {
      id: '.save',
      icon: 'save',
      label: '保存配置',
    },
  ])
}