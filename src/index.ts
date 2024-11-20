import { Context, Logger, Schema } from 'koishi';
import { resolve } from 'path';
import { DataService, Client } from '@koishijs/plugin-console';

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
    'get-qun-config'(): string[]
  }
}
// 定义表结构接口
export interface QunConfig {
  id: number;
  groupId: number;
  ownerId: number;
  members: Record<string, any>;
}

export interface QunVerify {
  id: number;
  captchaSize: number;
  expireTime: number;
}


// 定义插件名称和配置项
export const name = 'ourbot-gui';
export const inject = ['console', 'database'];

export function apply(ctx: Context) {
  logger.info('初始化插件');

  // 扩展数据库表结构
  ctx.model.extend('qunConfig', {
    id: 'unsigned',
    groupId: 'unsigned',
    ownerId: 'unsigned',
    members: 'json',
  });
  ctx.model.extend('qunVerify', {
    id: 'unsigned',
    captchaSize: { type: 'integer', initial: 6 },
    expireTime: { type: 'integer', initial: 300 },
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

  // 服务类定义，用于主动获取数据
  class QunConfigProvider extends DataService<QunConfig[]> {
    constructor(ctx: Context) {
      super(ctx, 'qunConfig')
    }
    async get() {
      const data = await ctx.database.get('qunConfig', {})
      logger.info('获取所有验证配置:', data)
      return data
    }
  }

  // 注册服务
  ctx.plugin(QunConfigProvider)

  
  // 更新 qunConfig 配置
  ctx.console.addListener('update-qun-config', async (data: Record<string, any>, client: any) => {
    try {
      const { userId } = await getUserQQ(this);
      logger.info(`用户 ${userId} 请求更新 qunConfig 配置:`, data);

      // 验证群配置的合法性
      for (const key in data) {
        const item = data[key];
        const groupId = parseInt(key, 10);
        if (!groupId || !item?.groupId) {
          throw new Error(`配置的群号不能为空: ${key}`);
        }
        if (item.ownerId !== userId) {
          throw new Error(`无权限修改群号 ${groupId} 的配置，ownerId 不匹配`);
        }
      }

      // 更新或插入配置数据
      const configData = Object.keys(data).map((key) => ({
        id: parseInt(key, 10),
        groupId: data[key].groupId,
        ownerId: userId,
        members: data[key].members || {},
      }));
      await ctx.database.upsert('qunConfig', (row) =>
        configData.map((item) => ({
          id: item.id,
          groupId: item.groupId,
          ownerId: item.ownerId,
          members: item.members,
        }))
      );

      logger.success(`用户 ${userId} 成功更新 qunConfig 配置`);
      return { success: true };
    } catch (error) {
      logger.error('更新 qunConfig 配置失败:', error);
      throw error;
    }
  });

  // 获取 qunConfig 配置
  ctx.console.addListener('get-qun-config', async () => {
    try {
      const { userId } = await getUserQQ(this);
      const data = await ctx.database.get('qunConfig', { ownerId: userId });
      logger.info(`用户 ${userId} 获取 qunConfig 配置成功:`, data);
      return data;
    } catch (error) {
      logger.error('获取 qunConfig 配置失败:', error);
      throw error;
    }
  });

  // 更新 qunVerify 配置
  ctx.console.addListener('update-qun-verify', async (data: Record<string, any>) => {
    try {
      logger.info('接收到更新 qunVerify 配置请求:', data);
      await ctx.database.remove('qunVerify', {});
      const verifyData = Object.keys(data).map((key) => ({
        id: parseInt(key, 10),
        captchaSize: data[key].captchaSize || 6,
        expireTime: data[key].expireTime || 300,
      }));
      await ctx.database.upsert('qunVerify', (row) =>
        verifyData.map((item) => ({
          id: item.id,
          captchaSize: item.captchaSize,
          expireTime: item.expireTime,
        }))
      );
      logger.success('qunVerify 配置更新成功');
      return { success: true };
    } catch (error) {
      logger.error('更新 qunVerify 配置失败:', error);
      throw error;
    }
  });

  // 获取 qunVerify 配置
  ctx.console.addListener('get-qun-verify', async () => {
    try {
      const data = await ctx.database.get('qunVerify', {});
      logger.info('获取 qunVerify 配置成功:', data);
      return data;
    } catch (error) {
      logger.error('获取 qunVerify 配置失败:', error);
      throw error;
    }
  });
}