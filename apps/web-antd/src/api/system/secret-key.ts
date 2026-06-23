import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemSecretKeyApi 定义秘钥管理相关接口类型。
export namespace SystemSecretKeyApi {
  // Status 表示秘钥启用状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // VersionItem 表示单个秘钥版本配置。
  export interface VersionItem {
    id: number; // 版本 ID
    keyVersion: string; // 版本号
    aesKeyRef: string; // AES KEY 文件绝对路径
    aesIvRef: string; // AES IV 文件绝对路径
    rsaPublicKeyUserRef: string; // 用户 RSA 公钥文件绝对路径
    rsaPublicKeyServerRef: string; // 服务端 RSA 公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef: string; // 服务端 RSA 私钥文件绝对路径
    secretMasked: boolean; // 当前敏感字段是否已脱敏
    status: Status; // 版本状态
    isStable: boolean; // 是否稳定版本
    isGray: boolean; // 是否灰度版本
    remark: string; // 版本备注
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // Item 表示秘钥管理列表项。
  export interface Item {
    id: number; // 秘钥ID
    uuid: string; // AppID/API KEY唯一标识
    title: string; // 秘钥标题
    keyVersion: string; // 当前默认展示的版本号
    stableVersion: string; // 稳定版本
    grayVersion: string; // 灰度版本
    grayPercent: number; // 灰度流量百分比
    aesKeyRef: string; // AES KEY 文件绝对路径
    aesIvRef: string; // AES IV 文件绝对路径
    rsaPublicKeyUserRef: string; // 用户 RSA 公钥文件绝对路径
    rsaPublicKeyServerRef: string; // 服务端 RSA 公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef: string; // 服务端 RSA 私钥文件绝对路径
    secretMasked: boolean; // 当前敏感字段是否已脱敏
    status: Status; // 状态
    signStatus: Status; // 签名验签状态
    cryptoStatus: Status; // 加密解密状态
    versionStatus: Status; // 当前版本状态
    versionCount: number; // 版本数量
    remark: string; // 备注
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
    versionList?: VersionItem[]; // 全部版本列表
  }

  // ListParams 表示秘钥列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    uuid?: string; // AppID筛选
    title?: string; // 标题筛选
    status?: Status; // 状态筛选
    signStatus?: Status; // 签名验签状态筛选
    cryptoStatus?: Status; // 加密解密状态筛选
    stableVersion?: string; // 稳定版本筛选
  }

  // SaveParams 表示新增或编辑秘钥参数。
  export interface SaveParams {
    uuid?: string; // AppID/API KEY唯一标识
    title?: string; // 秘钥标题
    keyVersion?: string; // 当前编辑的版本号
    aesKeyRef?: string; // AES KEY 文件绝对路径
    aesIvRef?: string; // AES IV 文件绝对路径
    rsaPublicKeyUserRef?: string; // 用户 RSA 公钥文件绝对路径
    rsaPublicKeyServerRef?: string; // 服务端 RSA 公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef?: string; // 服务端 RSA 私钥文件绝对路径
    status?: Status; // 状态
    signStatus?: Status; // 签名验签状态
    cryptoStatus?: Status; // 加密解密状态
    versionStatus?: Status; // 当前版本状态
    stableVersion?: string; // 稳定版本
    grayVersion?: string; // 灰度版本
    grayPercent?: number; // 灰度流量百分比
    remark?: string; // 备注
  }

  // CheckItem 表示单个秘钥校验项结果。
  export interface CheckItem {
    key: string; // 校验项唯一标识
    label: string; // 校验项标题
    passed: boolean; // 是否通过
    level: 'error' | 'success' | 'warning'; // 结果级别
    message: string; // 校验说明
  }

  // CheckResult 表示秘钥预检或自检结果。
  export interface CheckResult {
    uuid: string; // AppID/API KEY唯一标识
    title: string; // 秘钥标题
    keyVersion: string; // 当前校验版本号
    mode: 'self_check' | 'validate'; // 校验模式
    status: Status; // 当前状态
    allPassed: boolean; // 是否全部通过
    canSave: boolean; // 是否允许保存
    canEnable: boolean; // 是否允许启用
    runtimeChecked: boolean; // 是否执行了运行态自检
    cacheRefreshed: boolean; // 是否已刷新缓存
    checkedAt: string; // 校验时间
    durationMs: number; // 校验耗时
    items: CheckItem[]; // 分项结果
  }

  // ValidateParams 表示秘钥路径预检参数。
  export interface ValidateParams extends CommonApi.TwoStepReq {
    uuid?: string; // AppID/API KEY唯一标识
    title?: string; // 秘钥标题
    keyVersion?: string; // 当前校验版本号
    aesKeyRef?: string; // AES KEY 文件绝对路径
    aesIvRef?: string; // AES IV 文件绝对路径
    rsaPublicKeyUserRef?: string; // 用户 RSA 公钥文件绝对路径
    rsaPublicKeyServerRef?: string; // 服务端 RSA 公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef?: string; // 服务端 RSA 私钥文件绝对路径
    status?: Status; // 当前状态
    signStatus?: Status; // 签名验签状态
    cryptoStatus?: Status; // 加密解密状态
    versionStatus?: Status; // 当前版本状态
    stableVersion?: string; // 稳定版本
    grayVersion?: string; // 灰度版本
    grayPercent?: number; // 灰度流量百分比
  }
}

// fetchSecretKeyList 分页查询秘钥配置列表。
export async function fetchSecretKeyList(
  params: SystemSecretKeyApi.ListParams,
) {
  return requestClient.get<CommonApi.ListResult<SystemSecretKeyApi.Item>>(
    '/secret-keys',
    {
      params,
    },
  );
}

// fetchSecretKeyDetail 查询单个秘钥详情。
export async function fetchSecretKeyDetail(
  id: number,
  params?: CommonApi.TwoStepWithKeyVersionReq,
) {
  return requestClient.get<SystemSecretKeyApi.Item>(`/secret-keys/${id}`, {
    params,
  });
}

// createSecretKey 新增秘钥配置。
export async function createSecretKey(data: SystemSecretKeyApi.SaveParams) {
  return requestClient.post('/secret-keys', data);
}

// updateSecretKey 编辑秘钥配置。
export async function updateSecretKey(
  id: number,
  data: SystemSecretKeyApi.SaveParams,
) {
  return requestClient.patch(`/secret-keys/${id}`, data);
}

// updateSecretKeyStatus 修改秘钥启用状态。
export async function updateSecretKeyStatus(
  id: number,
  status: SystemSecretKeyApi.Status,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.patch(`/secret-keys/status/${id}`, {
    status,
    ...twoStep,
  });
}

// renewSecretKeyCache 刷新指定 AppID 的秘钥缓存。
export async function renewSecretKeyCache(
  uuid: string,
  twoStep?: CommonApi.TwoStepReq,
) {
  return requestClient.post(`/secret-keys/cache/refresh/${uuid}`, {
    ...twoStep,
  });
}

// validateSecretKeyPaths 预检秘钥路径与材料可用性。
export async function validateSecretKeyPaths(
  data: SystemSecretKeyApi.ValidateParams,
) {
  return requestClient.post<SystemSecretKeyApi.CheckResult>(
    '/secret-keys/validate',
    data,
  );
}

// selfCheckSecretKey 执行已落库秘钥的运行态自检。
export async function selfCheckSecretKey(
  uuid: string,
  payload?: CommonApi.TwoStepWithKeyVersionReq,
) {
  return requestClient.post<SystemSecretKeyApi.CheckResult>(
    `/secret-keys/self-check/${uuid}`,
    {
      ...payload,
    },
  );
}
