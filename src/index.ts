import { Context, Logger, Schema } from 'koishi';
import { resolve } from 'path';
import { DataService, Client } from '@koishijs/plugin-console';
import type { OneBotBot } from 'koishi-plugin-adapter-onebot';
// 创建 Logger 实例
const logger = new Logger('ourbot-gui');

// 定义数据库表结构
declare module 'koishi' {
  interface Tables {
    qunConfig: QunConfig;
    qunVerify: QunVerify;
  }
}

declare module '@koishijs/plugin-console' {
  interface Events {
    'get-qun-config'(): string[]; // 获取群配置
  }
}

// 定义表结构接口
export interface QunConfig {
  id: number; // 群号
  ownerId: number; // 群主 QQ
  members: Record<string, any>; // 成员列表
}

export interface QunVerify {
  id: number; // 群号
  captchaSize: number; // 验证码大小
  expireTime: number; // 验证码过期时间
}

// 定义插件名称和配置项
export const name = 'ourbot-gui';
export const inject = ['console', 'database'];

export function apply(ctx: Context) {
  logger.info('初始化插件');

  // 扩展数据库表结构
  ctx.model.extend('qunConfig', {
    id: { type: 'unsigned', primary: true }, // 群号作为主键
    ownerId: 'unsigned', // 群主 QQ
    members: 'json', // 成员列表
  });
  ctx.model.extend('qunVerify', {
    id: { type: 'unsigned', primary: true }, // 群号作为主键
    captchaSize: { type: 'integer', initial: 6 }, // 默认验证码大小
    expireTime: { type: 'integer', initial: 300 }, // 默认验证码过期时间
  });
  logger.info('数据表结构加载完成');

  // 注册控制台入口
  ctx.console.addEntry({
    dev: resolve(__dirname, '../client/index.ts'),
    prod: resolve(__dirname, '../dist'),
  });
  logger.info('控制台扩展页面已注册');

  // 获取当前用户的 QQ 号和 ID
  async function getUserQQ(client: any) {
    if (!client?.auth?.token) {
      throw new Error('当前未登录，请先登录。');
    }

    const userToken = client.auth.token;
    const tokenData = await ctx.database.get('token', { token: userToken });
    if (!tokenData || tokenData.length === 0) {
      throw new Error('未找到对应的 Token 数据');
    }

    const userId = tokenData[0].id;
    const bindingData = await ctx.database.get('binding', { aid: userId, platform: 'onebot' });
    if (!bindingData || bindingData.length === 0) {
      throw new Error(`未找到用户 ID ${userId} 的 QQ 号绑定信息`);
    }

    return { userId, userQQ: bindingData[0].pid };
  }

// 更新 qunConfig 配置
ctx.console.addListener('update-qun-config', async function (data: Record<string, any>) {
  const client = this as Client;
  if (!client) throw new Error('无法获取客户端对象');
  let oneBot: OneBotBot<Context> | null = null;

  for (const bot of ctx.bots) {
    if (bot.platform === 'onebot') {
      oneBot = bot as OneBotBot<Context>;
      break; // 找到一个 OneBot 实例后可以退出循环
    }
  }
  try {
    const { userQQ } = await getUserQQ(client);
    logger.info(`用户 QQ ${userQQ} 请求更新 qunConfig 配置:`, data);

    for (const key in data) {
      const id = parseInt(key, 10);
      const item = data[key];

      if (!id) throw new Error(`配置的群号不能为空: ${key}`);
      
      // 只检查是否为群主，而不检查 ownerId
      const groupOwner = await oneBot.internal.getGroupMemberInfo(id,userQQ);

      if (groupOwner.role !== 'owner') {
        logger.error(`用户 QQ ${userQQ} 不是群号 ${id} 的群主`);
        throw new Error(`用户 QQ ${userQQ} 不是群号 ${id} 的群主`);
      }

      await ctx.database.upsert('qunConfig', [
        {
          id,
          ownerId: userQQ,
          members: item.members || {},
        },
      ]);
    }

    logger.success(`用户 QQ ${userQQ} 成功更新 qunConfig 配置`);
    return { success: true };
  } catch (error) {
    logger.error('更新 qunConfig 配置失败:', error);
    throw error;
  }
});

  // 获取 qunConfig 配置
  ctx.console.addListener('get-qun-config', async function () {
    const client = this as Client;
    if (!client) throw new Error('无法获取客户端对象');

    try {
      const { userQQ } = await getUserQQ(client);

      const data = await ctx.database.get('qunConfig', { ownerId: userQQ });

      logger.info(`用户 QQ ${userQQ} 获取到的 qunConfig 配置数据:`, data);
      return data || [];
    } catch (error) {
      logger.error('获取 qunConfig 配置失败:', error);
      throw error;
    }
  });

  // 更新 qunVerify 配置
  ctx.console.addListener('update-qun-verify', async function (data: Record<string, any>) {
    const client = this as Client;
    if (!client) throw new Error('无法获取客户端对象');

    try {
      const { userQQ } = await getUserQQ(client);
      logger.info(`用户 QQ ${userQQ} 请求更新 qunVerify 配置:`, data);

      for (const key in data) {
        const id = parseInt(key, 10);
        const item = data[key];

        if (!id) throw new Error(`配置的群号不能为空: ${key}`);

        // 确认用户是否有权限
        const relatedConfig = await ctx.database.get('qunConfig', { id });
        if (!relatedConfig.length) throw new Error(`群号 ${id} 不存在关联的 qunConfig`);
        if (relatedConfig[0].ownerId !== userQQ) throw new Error(`无权限修改群号 ${id} 的配置`);

        await ctx.database.upsert('qunVerify', [
          {
            id,
            captchaSize: item.captchaSize || 6,
            expireTime: item.expireTime || 300,
          },
        ]);
      }

      logger.success(`用户 QQ ${userQQ} 成功更新 qunVerify 配置`);
      return { success: true };
    } catch (error) {
      logger.error('更新 qunVerify 配置失败:', error);
      throw error;
    }
  });

  // 获取 qunVerify 配置
  ctx.console.addListener('get-qun-verify', async function () {
    const client = this as Client;
    if (!client) throw new Error('无法获取客户端对象');

    try {
      const { userQQ } = await getUserQQ(client);

      // 获取与用户相关的 qunConfig
      const relatedConfigs = await ctx.database.get('qunConfig', {});
      const accessibleGroups = relatedConfigs
        .filter(config => config.ownerId === userQQ || (config.members && config.members[userQQ]))
        .map(config => config.id);

      // 获取 qunVerify 中对应的配置
      const data = await ctx.database.get('qunVerify', { id: accessibleGroups });

      logger.info(`用户 QQ ${userQQ} 获取到的 qunVerify 配置数据:`, data);
      return data || [];
    } catch (error) {
      logger.error('获取 qunVerify 配置失败:', error);
      throw error;
    }
  });
}
