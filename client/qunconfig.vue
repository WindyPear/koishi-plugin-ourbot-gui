<template>
  <k-layout menu="qun-config">
    <template #header>
      群配置管理
    </template>
    <template #default>
      <k-form
        :schema="schema"
        v-model="configDict"
        :initial="configDict"
        @update:modelValue="handleFormUpdate"
      />
      <k-comment v-if="message" :type="messageType">{{ message }}</k-comment>
    </template>
  </k-layout>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { Schema, send, useContext } from '@koishijs/client'

// 获取 Koishi 上下文
const ctx = useContext()

// 定义表单数据及消息提示
const configDict = ref({})
const message = ref('')
const messageType = ref('info')

// 定义表单 Schema
const schema = Schema.dict(
  Schema.object({
    id: Schema.number().hidden().role('id'),
    groupId: Schema.number().description('群号'),
    ownerId: Schema.number().description('群主 ID'),
    members: Schema.object().description('群成员配置'),
  }),
  Schema.string().description('群号')
).description('群配置列表')

// 初始化加载配置
onMounted(async () => {
  await fetchConfigs()
})

// 获取配置数据
const fetchConfigs = async () => {
  try {
    const data = await send('get-qun-config') // 调用后端接口获取群配置
    configDict.value = data.reduce((dict, config) => {
      dict[config.id] = {
        id: config.id,
        groupId: config.groupId,
        ownerId: config.ownerId,
        members: config.members,
      }
      return dict
    }, {})
    message.value = '配置数据加载成功'
    messageType.value = 'success'
  } catch (error) {
    console.error('加载配置失败:', error)
    configDict.value = {} // 确保 configDict 不为空
    message.value = '加载配置数据失败'
    messageType.value = 'danger'
  }
}

// 处理表单数据更新
const handleFormUpdate = (updatedDict) => {
  configDict.value = updatedDict
}

// 定义保存配置的菜单动作
ctx.action('qun-config.save', {
  disabled: () => !Object.keys(configDict.value).length, // 禁用条件：无任何配置
  action: async () => {
    try {
      const configData = Object.values(configDict.value).map(config => ({
        groupId: config.groupId,
        ownerId: config.ownerId,
        members: config.members,
      }))

      await send('update-qun-config', configData) // 保存更新配置
      message.value = '配置保存成功！'
      messageType.value = 'success'
    } catch (error) {
      console.error('保存配置失败:', error)
      message.value = '配置保存失败！'
      messageType.value = 'danger'
    }
  },
})
</script>