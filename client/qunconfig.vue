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
import { Schema, send } from '@koishijs/client';

const configDict = ref({}); // 初始为空对象
const message = ref('');
const messageType = ref('info');

const schema = Schema.dict(
  Schema.object({
    id: Schema.number().description('配置 ID').role('id'),
    captchaSize: Schema.number()
      .description('验证码长度')
      .min(1)
      .max(10)
      .default(6),
    expireTime: Schema.number()
      .description('验证码有效期（秒）')
      .min(60)
      .default(300),
  }),
  Schema.string().description('群号')
).description('群配置列表');

onMounted(async () => {
  await fetchConfigs();
});

// 获取配置数据并处理空值
const fetchConfigs = async () => {
  try {
    const data = await send('get-qun-config');
    // 增加安全性处理，确保 data 为数组
    const safeData = Array.isArray(data) ? data : [];
    configDict.value = safeData.reduce((dict, config) => {
      dict[config.groupId] = {
        id: config.id,
        captchaSize: config.captchaSize || 6,
        expireTime: config.expireTime || 300,
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

const handleFormUpdate = (updatedDict) => {
  configDict.value = updatedDict;
};
</script>
