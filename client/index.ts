import { Context } from '@koishijs/client' 
import Qunconfig from './qunconfig.vue'
import Verifyconfig from './verifyconfig.vue'
import QunBcmd from './qunbcmd.vue'  // 引入新的群禁用指令配置页面

export default (ctx: Context) => {
  // 定义页面
  ctx.page({
    name: '群主配置',
    path: '/qun-config',
    component: Qunconfig,
  })
  ctx.page({
    name: '进群验证配置',
    path: '/verify-config',
    component: Verifyconfig,
  })
  ctx.page({
    name: '群禁用指令配置',  // 新增页面名称
    path: '/qun-bcmd',  // 新增路径
    component: QunBcmd,  // 新增组件
  })

  // 定义菜单
  ctx.menu('qun-config', [
    {
      id: '.save',
      icon: 'save',
      label: '保存配置',
    },
  ])
  ctx.menu('verify-config', [
    {
      id: '.save',
      icon: 'save',
      label: '保存配置',
    },
  ])
  ctx.menu('qun-bcmd', [  // 新增群禁用指令配置菜单
    {
      id: '.save',
      icon: 'save',
      label: '保存配置',
    },
  ])
}
