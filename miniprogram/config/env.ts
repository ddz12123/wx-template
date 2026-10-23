export type AppEnvironment = 'develop' | 'trial' | 'release';

export interface EnvironmentConfig {
  /** 填写自己的 HTTPS API 地址；留空不影响首页启动。不得放置服务端密钥。 */
  apiBaseUrl: string;
}

const environments: Record<AppEnvironment, EnvironmentConfig> = {
  develop: { apiBaseUrl: '' },
  trial: { apiBaseUrl: '' },
  release: { apiBaseUrl: '' },
};

/** 发布渠道不等同于后端部署环境，提交审核前请检查相应地址。 */
export function getEnvironment(): AppEnvironment {
  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    return envVersion === 'trial' || envVersion === 'release' ? envVersion : 'develop';
  } catch {
    return 'develop';
  }
}

export function getEnvironmentConfig(name: AppEnvironment = getEnvironment()): EnvironmentConfig {
  return environments[name];
}

export function getApiBaseUrl(name: AppEnvironment = getEnvironment()): string {
  return getEnvironmentConfig(name).apiBaseUrl;
}
