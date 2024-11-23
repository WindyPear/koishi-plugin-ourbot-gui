<template>
  <k-layout menu="qun-config">
    <template #header>
      群配置管理
    </template>
    <template #default>
      <k-form
        :schema="schema"
        v-model="configDict"
        @update:modelValue="handleFormUpdate"
      />
      <k-comment v-if="message" :type="messageType">{{ message }}</k-comment>
    </template>
  </k-layout>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Schema, send, useContext } from '@koishijs/client';

// 数据存储
const configDict = ref({}); // 初始为空对象
const message = ref('');
const messageType = ref('info');

// 获取 Koishi 上下文
const ctx = useContext();

// 表单 Schema 定义
const schema = Schema.dict(
  Schema.object({
    members: Schema.array(Schema.string())
      .description('成员列表')
      .default([]),
  })
).description('群配置列表');

// 初始化时加载配置
onMounted(async () => {
  await fetchConfigs();
});

// 获取配置数据并处理空值
const fetchConfigs = async () => {
  try {
    const data = await send('get-qun-config');
    const safeData = Array.isArray(data) ? data : [];
    configDict.value = safeData.reduce((dict, config) => {
      dict[config.id] = {
        members: config.members || [],
      };
      return dict;
    }, {});
    message.value = '配置数据加载成功';
    messageType.value = 'success';
  } catch (error) {
    message.value = '加载配置数据失败';
    messageType.value = 'danger';
  }
};

// 处理表单更新
const handleFormUpdate = (updatedDict) => {
  configDict.value = updatedDict;
};

// 提交更新到后端
const submitUpdates = async () => {
  try {
    await send('update-qun-config', configDict.value);
    message.value = '配置更新成功';
    messageType.value = 'success';
  } catch (error) {
    message.value = '配置更新失败';
    messageType.value = 'danger';
  }
};

// 定义保存配置的菜单动作
ctx.action('qun-config.save', {
  disabled: () => !Object.keys(configDict.value).length, // 禁用条件：无任何配置
  action: async () => {
    try {
      message.value = '正在保存配置...';
      messageType.value = 'info';
      await submitUpdates();
    } catch (error) {
      message.value = '配置保存失败！';
      messageType.value = 'danger';
    }
  },
});
</script>
