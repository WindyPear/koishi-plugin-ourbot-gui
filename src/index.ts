import { Context, Logger, Schema } from 'koishi';
import { resolve } from 'path';
import { Client } from '@koishijs/plugin-console';
import type { OneBotBot } from 'koishi-plugin-adapter-onebot';
// 创建 Logger 实例
const logger = new Logger('ourbot-gui');

// 定义数据库表结构
declare module 'koishi' {
  interface Tables {
    qunConfig: QunConfig;
    qunVerify: QunVerify;
    qunBcmd: QunBcmd;
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

export interface qunBcmd {
  id: number; // 群号
  disabledCommands: string[]; // 禁用的指令列表
}

// 控制台事件扩展
declare module '@koishijs/plugin-console' {
  interface Events {
    'get-qun-config'(): string[]; // 获取群配置
    'get-qun-verify'(): any[];  // 获取 qunVerify 配置
    'get-qun-bcmd'(): any[];    // 获取 qunBcmd 配置
    'update-qun-bcmd'(): void;  // 更新 qunBcmd 配置
    'update-qun-verify'(): void;  // 更新 qunBcmd 配置
    'update-qun-config'(): void;  // 更新 qunBcmd 配置
  }
}
// 定义插件名称和配置项
export const name = 'ourbot-gui';
export const inject = ['console', 'database'];

export function apply(ctx: Context) {
  logger.info('初始化插件');
  ctx.middleware(async (session, next) => { // 将函数改为异步
    const groupId = session.guildId; // 当前消息的群号
    const messageContent = session.content; // 获取消息内容
    logger.info(messageContent);
    
    if (!groupId || !messageContent) {
      return next(); // 如果没有群号或消息内容，跳过处理
    }
    
    // 从数据库获取该群的禁用指令列表
    const bcmdConfig = await ctx.database.get('qunBcmd', { id: groupId }); // 使用 await

    if (bcmdConfig.length) {
      // 遍历禁用的指令前缀列表，检查消息内容的前缀
      for (const disabledCommand of bcmdConfig[0].disabledCommands) {
        if (messageContent.startsWith(disabledCommand)) {
          return ''; // 禁用该指令，返回
        }
      }
    }

    // 如果指令未禁用，继续处理
    return next();
  });

  
  
// 扩展数据库表结构
ctx.model.extend('qunConfig', {
  id: { type: 'unsigned'}, // 群号作为主键
  ownerId: 'unsigned', // 群主 QQ
  members: 'json', // 成员列表
});

ctx.model.extend('qunVerify', {
  id: { type: 'unsigned'}, // 群号作为主键
  captchaSize: { type: 'integer', initial: 6 }, // 默认验证码大小
  expireTime: { type: 'integer', initial: 300 }, // 默认验证码过期时间
});

// 扩展 qunBcmd 表结构
ctx.model.extend('qunBcmd', {
  id: { type: 'unsigned'}, // 群号作为主键
  disabledCommands: { type: 'json', initial: [] }, // 禁用的指令数组
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


//以下是qunconfig

// 更新 qunConfig 配置
ctx.console.addListener('update-qun-config', async function (data: Record<string, any>) {
  const client = this as Client;
  if (!client) throw new Error('无法获取客户端对象');

  let oneBot: OneBotBot<Context> | null = null;

  // 获取 OneBot 实例
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
      const id = parseInt(key, 10); // 确保 id 在循环内部作用域中定义
      const item = data[key];

      if (!id) throw new Error(`配置的群号不能为空: ${key}`);

      // 检查是否为群主，而不检查 ownerId
      const groupOwner = await oneBot.internal.getGroupMemberInfo(id, userQQ);
      if (groupOwner.role !== 'owner') {
        logger.error(`用户 QQ ${userQQ} 不是群号 ${id} 的群主`);
        throw new Error(`用户 QQ ${userQQ} 不是群号 ${id} 的群主`);
      }

      // 更新 qunConfig 配置
      await ctx.database.upsert('qunConfig', [
        {
          id,
          ownerId: userQQ,
          members: item.members || {},
        },
      ]);
      logger.info(`群号 ${id} 的 qunConfig 配置已更新`);

      // 检查并初始化对应的 qunVerify 配置
      const existingVerifyConfig = await ctx.database.get('qunVerify', { id });
      if (!existingVerifyConfig.length) {
        await ctx.database.create('qunVerify', {
          id, // 使用当前作用域内的 id
          captchaSize: 6, // 默认验证码长度
          expireTime: 300, // 默认验证码有效期
        });
        logger.info(`群号 ${id} 的 qunVerify 配置已初始化`);
      }

      // 检查并初始化对应的 qunBcmd 配置
      const existingBcmdConfig = await ctx.database.get('qunBcmd', { id });
      if (!existingBcmdConfig.length) {
        await ctx.database.create('qunBcmd', {
          id, // 使用当前作用域内的 id
          disabledCommands: [], // 默认禁用指令为空
        });
        logger.info(`群号 ${id} 的 qunBcmd 配置已初始化`);
      }
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


//以下是qunverify



// 更新 qunVerify 配置
ctx.console.addListener('update-qun-verify', async function (data: Record<string, any>) {
  const client = this as Client;
  if (!client) throw new Error('无法获取客户端对象');

  try {
    const { userQQ } = await getUserQQ(client);
    const userQQStr = userQQ.toString(); // 确保 userQQ 是字符串类型

    logger.info(`用户 QQ ${userQQ} 请求更新 qunVerify 配置:`, data);

    for (const key in data) {
      const id = parseInt(key, 10); // 群号
      const item = data[key];

      if (!id) throw new Error(`配置的群号不能为空: ${key}`);

      // 验证权限
      const relatedConfig = await ctx.database.get('qunConfig', { id });
      if (!relatedConfig.length) throw new Error(`群号 ${id} 不存在关联的 qunConfig`);
      if (relatedConfig[0].ownerId.toString() !== userQQStr) {
        throw new Error(`无权限修改群号 ${id} 的配置`);
      }

      // 检查是否存在对应的 qunVerify 数据
      const existingVerifyConfig = await ctx.database.get('qunVerify', { id });
      if (!existingVerifyConfig.length) {
        logger.error(`群号 ${id} 的 qunVerify 配置不存在，禁止创建新配置`);
        throw new Error(`群号 ${id} 的 qunVerify 配置不存在，无法更新`);
      }

      // 更新已有的 qunVerify 数据
      await ctx.database.upsert('qunVerify', [
        {
          id,
          captchaSize: item.captchaSize || existingVerifyConfig[0].captchaSize, // 如果没有新值，保留原值
          expireTime: item.expireTime || existingVerifyConfig[0].expireTime,   // 如果没有新值，保留原值
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
    
    // 确保 userQQ 转为字符串
    const userQQStr = userQQ.toString();

    // 获取与用户相关的 qunConfig
    const relatedConfigs = await ctx.database.get('qunConfig', {});
    
    // 筛选出用户有权限的群号
    const accessibleGroups = relatedConfigs
      .filter(config => 
        config.ownerId.toString() === userQQStr || // 将 ownerId 转为字符串进行比较
        (config.members && config.members[userQQStr]) // 确保 userQQ 转为字符串进行比较
      )
      .map(config => config.id);

    if (!accessibleGroups.length) {
      logger.warn(`用户 QQ ${userQQ} 没有权限访问任何 qunVerify 配置`);
      return []; // 返回空数组，表示无权限访问任何配置
    }

    // 从 qunVerify 表中获取对应的配置
    const data = await ctx.database.get('qunVerify', { id: accessibleGroups });

    logger.info(`用户 QQ ${userQQ} 获取到的 qunVerify 配置数据:`, data);
    return data || [];
  } catch (error) {
    logger.error('获取 qunVerify 配置失败:', error);
    throw error;
  }
});






//以下是qunBcmd



// 获取 qunBcmd 配置
ctx.console.addListener('get-qun-bcmd', async function () {
  const client = this as Client;
  if (!client) throw new Error('无法获取客户端对象');

  try {
    const { userQQ } = await getUserQQ(client);
    const userQQStr = userQQ.toString(); // 确保 userQQ 是字符串类型

    // 获取与用户相关的 qunConfig
    const relatedConfigs = await ctx.database.get('qunConfig', {});
    const accessibleGroups = relatedConfigs
      .filter(config =>
        config.ownerId.toString() === userQQStr || // 比较时转换 ownerId 为字符串
        (config.members && config.members[userQQStr]) // 确保成员检查时一致
      )
      .map(config => config.id);

    if (!accessibleGroups.length) {
      logger.warn(`用户 QQ ${userQQ} 没有权限访问任何 qunBcmd 配置`);
      return []; // 返回空数组，表示无权限
    }

    // 从 qunBcmd 表中获取对应配置
    const data = await ctx.database.get('qunBcmd', { id: accessibleGroups });

    logger.info(`用户 QQ ${userQQ} 获取到的 qunBcmd 配置数据:`, data);
    return data || [];
  } catch (error) {
    logger.error('获取 qunBcmd 配置失败:', error);
    throw error;
  }
});

// 更新 qunBcmd 配置
ctx.console.addListener('update-qun-bcmd', async function (data: Record<string, any>) {
  const client = this as Client;
  if (!client) throw new Error('无法获取客户端对象');

  try {
    const { userQQ } = await getUserQQ(client);
    const userQQStr = userQQ.toString(); // 确保 userQQ 是字符串类型

    logger.info(`用户 QQ ${userQQ} 请求更新 qunBcmd 配置:`, data);

    for (const key in data) {
      const id = parseInt(key, 10);
      const item = data[key];

      if (!id) throw new Error(`配置的群号不能为空: ${key}`);

      // 验证权限
      const relatedConfig = await ctx.database.get('qunConfig', { id });
      if (!relatedConfig.length) throw new Error(`群号 ${id} 不存在关联的 qunConfig`);
      if (relatedConfig[0].ownerId.toString() !== userQQStr) {
        throw new Error(`无权限修改群号 ${id} 的配置`);
      }

      // 更新配置
      await ctx.database.upsert('qunBcmd', [
        {
          id,
          disabledCommands: item.disabledCommands || [],
        },
      ]);
    }

    logger.success(`用户 QQ ${userQQ} 成功更新 qunBcmd 配置`);
    return { success: true };
  } catch (error) {
    logger.error('更新 qunBcmd 配置失败:', error);
    throw error;
  }
});
}