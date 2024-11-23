<template>
  <k-layout menu="verify-config">
    <template #header>
      验证配置管理
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
    captchaSize: Schema.number()
      .description('验证码长度')
      .min(1)
      .max(10)
      .default(6),
    expireTime: Schema.number()
      .description('验证码有效期（秒）')
      .min(60)
      .default(300),
  })
).description('验证配置列表');

// 初始化时加载配置
onMounted(async () => {
  await fetchConfigs();
});

// 获取配置数据并处理空值
const fetchConfigs = async () => {
  try {
    const data = await send('get-qun-verify');
    const safeData = Array.isArray(data) ? data : [];
    configDict.value = safeData.reduce((dict, config) => {
      dict[config.id] = {
        captchaSize: config.captchaSize || 6,
        expireTime: config.expireTime || 300,
      };
      return dict;
    }, {});
    message.value = '验证配置加载成功';
    messageType.value = 'success';
  } catch (error) {
    message.value = '加载验证配置失败';
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
    await send('update-qun-verify', configDict.value);
    message.value = '验证配置更新成功';
    messageType.value = 'success';
  } catch (error) {
    message.value = '验证配置更新失败';
    messageType.value = 'danger';
  }
};

// 定义保存配置的菜单动作
ctx.action('verify-config.save', {
  disabled: () => !Object.keys(configDict.value).length, // 禁用条件：无任何配置
  action: async () => {
    try {
      message.value = '正在保存验证配置...';
      messageType.value = 'info';
      await submitUpdates();
    } catch (error) {
      message.value = '验证配置保存失败！';
      messageType.value = 'danger';
    }
  },
});
</script>
