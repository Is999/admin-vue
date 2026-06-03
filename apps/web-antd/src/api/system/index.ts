import type { CommonApi } from '#/api/common';

import { requestClient } from '#/api/request';

// SystemAdminApi 定义后台管理员管理相关接口类型。
export namespace SystemAdminApi {
  // Status 表示后台账号启用状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示管理员列表与详情数据。
  export interface Item {
    id: number; // 管理员ID
    username: string; // 登录用户名
    realName: string; // 真实姓名
    needResetPassword: number; // 是否必须先修改登录密码：1需要
    email: string; // 邮箱
    phone: string; // 手机号
    mfaStatus: Status; // MFA状态
    status: Status; // 账号状态
    avatar: string; // 头像地址
    description: string; // 备注说明
    lastLoginTime: string; // 最近登录时间
    lastLoginIP: string; // 最近登录IP
    lastLoginIpaddr: string; // 最近登录IP归属地
    roleIDs: number[]; // 已绑定角色ID
    roles: Array<{ id: number; title: string }>; // 已绑定角色列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示管理员列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    username?: string; // 用户名筛选
    realName?: string; // 真实姓名筛选
    roleID?: number; // 角色ID筛选
    status?: Status; // 状态筛选
  }

  // ExportParams 表示管理员列表导出筛选参数。
  export interface ExportParams {
    username?: string; // 用户名筛选
    realName?: string; // 真实姓名筛选
    roleID?: number; // 角色ID筛选
    status?: Status; // 状态筛选
  }

  // ExportTriggerResp 表示管理员列表导出任务提交回执。
  export interface ExportTriggerResp {
    jobId: string; // 导出任务ID
    queue: string; // 队列名称
    status: string; // 初始状态
    taskId: string; // 后台任务ID
  }

  // ExportStatusResp 表示管理员列表导出任务进度。
  export interface ExportStatusResp {
    jobId: string; // 导出任务ID
    taskId: string; // 后台任务ID
    queue: string; // 队列名称
    status: 'failed' | 'queued' | 'running' | 'succeeded'; // 导出状态
    progress: number; // 当前进度百分比
    processed: number; // 已处理行数
    total: number; // 总行数
    estimatedSeconds: number; // 剩余预估秒数
    fileName: string; // 导出文件名
    downloadReady: boolean; // 是否已可下载
    errorMessage: string; // 失败原因
    createdAt: string; // 创建时间
    startedAt: string; // 开始时间
    finishedAt: string; // 完成时间
    updatedAt: string; // 更新时间
    downloadUrl: string; // 下载地址
    processAt: string; // 计划执行时间
    lastProcessedAt: string; // 最近处理时间
    averageRowsPerSec: number; // 平均处理速度
  }

  // SaveParams 表示新增或编辑管理员参数。
  export interface SaveParams {
    username?: string; // 登录用户名
    realName?: string; // 真实姓名
    email?: string; // 邮箱
    phone?: string; // 手机号
    password?: string; // 登录密码
    avatar?: string; // 头像地址
    description?: string; // 备注说明
    mfaSecureKey?: string; // MFA密钥
    mfaStatus?: Status; // MFA状态
    status?: Status; // 账号状态
    roleIDs?: number[]; // 角色ID列表
    isUpdateRoles?: boolean; // 是否同步角色
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
  }

  // RoleItem 表示管理员已绑定角色列表项。
  export interface RoleItem {
    id: number; // 角色ID
    title: string; // 角色名称
    status: Status; // 角色状态
    description: string; // 角色说明
    createdAt: string; // 绑定时间
  }
}

// SystemRoleApi 定义后台角色管理相关接口类型。
export namespace SystemRoleApi {
  // Status 表示角色状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示角色列表、树与详情数据。
  export interface Item {
    id: number; // 角色ID
    title: string; // 角色名称
    pid: number; // 上级角色ID
    pids: string; // 上级角色族谱
    status: Status; // 角色状态
    description: string; // 角色描述
    isDelete: number; // 删除标记
    disabled: boolean; // 是否禁用
    disableCheckbox: boolean; // 是否禁止勾选
    selectable: boolean; // 是否允许选择
    permissions: number[]; // 权限ID列表
    children?: Item[]; // 子角色列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示角色列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    title?: string; // 角色名称筛选
    pid?: number; // 上级角色筛选
    status?: Status; // 状态筛选
  }

  // SaveParams 表示新增或编辑角色参数。
  export interface SaveParams {
    title?: string; // 角色名称
    pid?: number; // 上级角色ID
    status?: Status; // 角色状态
    description?: string; // 角色描述
    permissions?: number[]; // 权限ID列表
  }
}

// SystemPermissionApi 定义后台权限管理相关接口类型。
export namespace SystemPermissionApi {
  // Status 表示权限状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // Item 表示权限列表、树与角色权限树数据。
  export interface Item {
    id: number; // 权限ID
    uuid: string; // 权限标识
    title: string; // 权限名称
    module: string; // 模块名称
    pid: number; // 上级权限ID
    pids: string; // 上级权限族谱
    type: number; // 权限类型
    description: string; // 权限描述
    status: Status; // 权限状态
    checked: boolean; // 角色权限树是否勾选
    disabled: boolean; // 是否禁用
    disableCheckbox: boolean; // 是否禁止勾选
    selectable: boolean; // 是否允许选择
    children?: Item[]; // 子权限列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示权限列表查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    uuid?: string; // 权限标识筛选
    title?: string; // 权限名称筛选
    module?: string; // 模块筛选
    pid?: number; // 上级权限筛选
    status?: Status; // 状态筛选
    type?: number[]; // 权限类型筛选
  }

  // SaveParams 表示新增或编辑权限参数。
  export interface SaveParams {
    uuid?: string; // 权限标识
    title?: string; // 权限名称
    module?: string; // 模块名称
    pid?: number; // 上级权限ID
    type?: number; // 权限类型
    description?: string; // 权限说明
    status?: Status; // 权限状态
  }

  // MaxUuidResp 表示后端返回的下一个权限标识。
  export interface MaxUuidResp {
    uuid: string; // 下一个权限标识
  }
}

// SystemConfigApi 定义字典配置相关接口类型。
export namespace SystemConfigApi {
  // Item 表示字典配置列表项。
  export interface Item {
    id: number; // 配置ID
    uuid: string; // 配置UUID
    title: string; // 配置标题
    type: number; // 配置类型
    value: any; // 配置值
    example: any; // 配置示例
    remark: string; // 备注
    page: string; // 页面路径
    pid: number; // 上级配置ID
    pids: string; // 上级配置族谱
    version: number; // 配置版本
    editable: number; // 是否可编辑
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
  }

  // ListParams 表示字典配置查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    uuid?: string; // 配置UUID筛选
    title?: string; // 配置标题筛选
    pagePath?: string; // 页面路径筛选
  }

  // SaveParams 表示新增或编辑字典配置参数。
  export interface SaveParams {
    uuid?: string; // 配置UUID
    title?: string; // 配置标题
    type?: number; // 配置类型
    value?: any; // 配置值
    example?: any; // 配置示例
    remark?: string; // 备注
    page?: string; // 页面路径
    pid?: number; // 上级配置ID
    version?: number; // 乐观锁版本号，编辑时必传
  }

  // ImportResp 表示字典配置 Excel 导入结果。
  export interface ImportResp {
    created: number; // 新增数量
    updated: number; // 更新数量
    skipped: number; // 跳过数量
  }
}

// SystemCacheApi 定义缓存管理相关接口类型。
export namespace SystemCacheApi {
  // Item 表示系统内置可刷新缓存目标。
  export interface Item {
    index: string; // 缓存索引
    key: string; // 缓存Key
    keyTitle: string; // 缓存标题
    type: string; // Redis类型
    remark: string; // 缓存说明
    category: string; // 缓存分类
    isTemplate: boolean; // 是否为模板缓存键
    exampleKey: string; // 模板缓存示例键
    autoRebuild: boolean; // 查看详情 miss 时是否自动回源重建
    refreshScope: string; // 刷新粒度
  }

  // KeyInfo 表示 Redis Key 详情。
  export interface KeyInfo {
    key: string; // 缓存Key
    type: string; // Redis类型
    ttl: number; // 剩余过期秒数
    total: number; // 值数量
    value: any; // 当前缓存值
    item?: Item | null; // 当前缓存键命中的缓存项元信息
  }

  // SearchItem 表示缓存键检索结果项。
  export interface SearchItem {
    key: string; // 真实 Redis Key
    item?: Item | null; // 当前缓存键命中的缓存项元信息
  }

  // SearchResp 表示缓存键分页检索结果。
  export interface SearchResp {
    list: SearchItem[]; // 当前页真实 Redis Key
    total: number; // 当前搜索条件下已确认存在的 Key 总数
    page: number; // 当前页码
    pageSize: number; // 当前每页数量
    hasMore: boolean; // 是否还有下一页
    nextPage?: number; // 下一页页码
    searchPath?: string; // 后端搜索链路
    providerName?: string; // 模板 provider 名称
    templateKey?: string; // 命中的模板 Key 定义
    candidateTotal?: number; // 模板候选 Key 数量
    existingTotal?: number; // 已确认存在的 Key 数量
    limited?: boolean; // 是否触发后端搜索窗口保护
    maxResults?: number; // 后端最大搜索窗口
  }

  // SearchParams 表示缓存键分页检索请求参数。
  export interface SearchParams {
    key: string; // 缓存 Key 或已登记模板搜索模式
    source?: string; // 请求来源标记，便于后端日志排障
    page?: number; // 页码
    pageSize?: number; // 每页数量
  }

  // WarmupResp 表示模板缓存预热响应。
  export interface WarmupResp {
    templateKey: string; // 模板缓存 key 定义
    total: number; // 处理的实例 key 总数
    success: number; // 预热成功数量
    failed: number; // 预热失败数量
    failedKeys?: string[]; // 失败 key 采样列表
    latencyMs: number; // 耗时毫秒
  }

  // ServerInfo 表示 Redis 服务信息。
  export type ServerInfo = Record<string, Record<string, string>>;
}

// SystemAdminLogApi 定义后台操作日志相关接口类型。
export namespace SystemAdminLogApi {
  // Item 表示后台审计日志列表项。
  export interface Item {
    id: number; // 日志ID
    userID: number; // 操作管理员ID
    username: string; // 管理员用户名
    action: string; // 操作动作
    route: string; // 路由别名
    method: string; // 后端方法标识
    describe: string; // 中文描述
    data: string; // 请求参数快照
    ip: string; // 客户端IP
    ipaddr: string; // IP归属地
    traceId: string; // Trace ID
    spanId: string; // Span ID
    httpStatus: number; // HTTP状态码
    bizCode: number; // 业务码
    latencyMs: number; // 请求耗时毫秒
    success: boolean; // 是否成功
    errorMessage: string; // 错误信息
    createdAt: string; // 创建时间
  }

  // ListParams 表示后台审计日志查询参数。
  export interface ListParams {
    page?: number; // 当前页码
    pageSize?: number; // 每页条数
    traceID?: string; // Trace ID筛选
    userID?: number; // 用户ID筛选
    username?: string; // 用户名筛选
    action?: string; // 操作动作筛选
  }
}

// SystemSecretKeyApi 定义秘钥管理相关接口类型。
export namespace SystemSecretKeyApi {
  // Status 表示秘钥启用状态，1=启用，0=禁用。
  export type Status = 0 | 1;

  // VersionItem 表示单个秘钥版本配置。
  export interface VersionItem {
    id: number; // 版本ID
    keyVersion: string; // 版本号
    aesKeyRef: string; // AES KEY 文件绝对路径
    aesIvRef: string; // AES IV 文件绝对路径
    rsaPublicKeyUserRef: string; // 用户RSA公钥文件绝对路径
    rsaPublicKeyServerRef: string; // 服务端RSA公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef: string; // 服务端RSA私钥文件绝对路径
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
    rsaPublicKeyUserRef: string; // 用户RSA公钥文件绝对路径
    rsaPublicKeyServerRef: string; // 服务端RSA公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef: string; // 服务端RSA私钥文件绝对路径
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
    rsaPublicKeyUserRef?: string; // 用户RSA公钥文件绝对路径
    rsaPublicKeyServerRef?: string; // 服务端RSA公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef?: string; // 服务端RSA私钥文件绝对路径
    status?: Status; // 状态
    signStatus?: Status; // 签名验签状态
    cryptoStatus?: Status; // 加密解密状态
    versionStatus?: Status; // 当前版本状态
    stableVersion?: string; // 稳定版本
    grayVersion?: string; // 灰度版本
    grayPercent?: number; // 灰度流量百分比
    remark?: string; // 备注
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
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
  export interface ValidateParams {
    uuid?: string; // AppID/API KEY唯一标识
    title?: string; // 秘钥标题
    keyVersion?: string; // 当前校验版本号
    aesKeyRef?: string; // AES KEY 文件绝对路径
    aesIvRef?: string; // AES IV 文件绝对路径
    rsaPublicKeyUserRef?: string; // 用户RSA公钥文件绝对路径
    rsaPublicKeyServerRef?: string; // 服务端RSA公钥路径，可为空并由私钥派生
    rsaPrivateKeyServerRef?: string; // 服务端RSA私钥文件绝对路径
    status?: Status; // 当前状态
    signStatus?: Status; // 签名验签状态
    cryptoStatus?: Status; // 加密解密状态
    versionStatus?: Status; // 当前版本状态
    stableVersion?: string; // 稳定版本
    grayVersion?: string; // 灰度版本
    grayPercent?: number; // 灰度流量百分比
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
  }
}

// SystemSecurityDebugApi 定义安全调试台相关接口类型。
export namespace SystemSecurityDebugApi {
  export interface SignParams {
    appId: string; // AppID，对应 secret_key.uuid
    payloadText: string; // 待签名 JSON 文本
    requestId?: string; // 可选请求标识，和真实链路 X-Trace-Id 等价并参与签名
    traceId?: string; // 兼容字段，对应 X-Trace-Id
    signatureType?: 'A' | 'M' | 'R'; // 签名方式
    signFields?: string[]; // 参与签名的字段
  }

  export interface VerifyParams extends SignParams {
    sign: string; // 待校验签名值
  }

  export interface CipherParams {
    appId: string; // AppID，对应 secret_key.uuid
    cryptoType?: 'A' | 'R'; // 加密方式
    cipherFields?: string[]; // 字段加解密配置，传 ["cipher"] 表示整包
    ciphertext?: string; // 整包解密时的密文
    payloadText?: string; // 明文或字段模式 JSON 文本
  }

  export interface SignResult {
    appId: string; // 实际参与签名的 AppID
    payload: Record<string, any>; // 归一化后的待签名对象
    payloadText: string; // 归一化后的 JSON 文本
    requestId?: string; // 后端返回的请求标识
    traceId: string; // 实际参与签名的追踪标识，对应 X-Trace-Id
    sign: string; // 生成的签名值
    signFields: string[]; // 实际参与签名的字段
    signText: string; // 最终签名串
    signatureType: string; // 实际签名方式
  }

  export interface VerifyResult extends SignResult {
    verified: boolean; // 是否验签成功
  }

  export interface CipherResult {
    appId: string; // AppID
    cipherFields: string[]; // 字段配置
    cipherHeader: string; // 可直接用于 X-Cipher 的头值
    ciphertext?: string; // 整包加密后的密文
    cryptoType: string; // 实际加密方式
    payload?: Record<string, any>; // 输入对象
    payloadText: string; // 输入文本
    plaintext?: string; // 解密后的明文
    resultPayload?: Record<string, any>; // 处理后的对象
    resultPayloadText?: string; // 处理后的 JSON 文本
    wholeBody: boolean; // 是否整包模式
  }
}

// SystemProfileApi 定义个人信息页面使用的数据类型。
export namespace SystemProfileApi {
  // Item 表示当前登录管理员资料。
  export interface Item extends Partial<SystemAdminApi.Item> {
    buildMFAURL?: string; // MFA绑定二维码地址
    existMFA?: boolean; // 是否已经绑定MFA设备
    forceMFAEnabled?: boolean; // 系统是否开启强制启用MFA
    id?: number; // 当前用户ID
    mfaBindRequired?: boolean; // 当前登录是否必须先绑定并启用MFA
    needResetPassword?: number; // 是否必须先修改登录密码
    mfaCheck?: number; // 当前登录是否需要先完成MFA校验
    token?: string; // 当前访问令牌
  }

  // RefreshMfaSecretResp 表示重新生成 MFA 秘钥后的响应。
  export interface RefreshMfaSecretResp {
    buildMFAURL?: string; // 重新生成后的 MFA 绑定二维码地址
  }

  // UpdateMineParams 表示个人中心基础资料更新参数。
  export interface UpdateMineParams {
    avatar?: string; // 头像地址
    description?: string; // 个人说明
    email?: string; // 邮箱
    phone?: string; // 手机号
    realName?: string; // 真实姓名
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
  }

  // UpdatePasswordParams 表示个人中心修改密码参数。
  export interface UpdatePasswordParams {
    confirmPassword: string; // 确认新密码
    passwordNew: string; // 新密码
    passwordOld: string; // 旧密码
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
  }

  // UpdateMfaStatusParams 表示个人中心修改MFA状态参数。
  export interface UpdateMfaStatusParams {
    mfaStatus: number; // MFA状态：0关闭，1开启
    mfaSecureKey?: string; // 当前绑定流程使用的TOTP MFA秘钥
    twoStepKey?: string; // MFA二次校验票据key
    twoStepValue?: string; // MFA二次校验票据value
  }
}

// fetchAdminList 分页查询管理员列表。
export async function fetchAdminList(params: SystemAdminApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<SystemAdminApi.Item>>(
    '/admins',
    {
      params,
    },
  );
}

// triggerAdminExport 提交管理员列表异步导出任务。
export async function triggerAdminExport(data: SystemAdminApi.ExportParams) {
  return requestClient.post<SystemAdminApi.ExportTriggerResp>(
    '/admins/exports',
    data,
  );
}

// fetchAdminExportStatus 查询管理员列表异步导出进度。
export async function fetchAdminExportStatus(jobId: string) {
  return requestClient.get<SystemAdminApi.ExportStatusResp>(
    `/admins/exports/status/${encodeURIComponent(jobId)}`,
  );
}

// downloadAdminExport 下载管理员列表导出文件。
export async function downloadAdminExport(jobId: string) {
  return requestClient.download<Blob>(
    `/admins/exports/download/${encodeURIComponent(jobId)}`,
  );
}

// fetchAdminDetail 查询管理员详情。
export async function fetchAdminDetail(id: number) {
  return requestClient.get<SystemAdminApi.Item>(`/admins/${id}`);
}

// createAdmin 新增管理员。
export async function createAdmin(data: SystemAdminApi.SaveParams) {
  return requestClient.post('/admins', data);
}

// updateAdmin 编辑管理员。
export async function updateAdmin(id: number, data: SystemAdminApi.SaveParams) {
  return requestClient.patch(`/admins/${id}`, data);
}

// deleteAdmin 删除管理员。
export async function deleteAdmin(
  id: number,
  twoStep?: { twoStepKey?: string; twoStepValue?: string },
) {
  return requestClient.delete(`/admins/${id}`, {
    data: { ...twoStep },
  });
}

// updateAdminStatus 修改管理员状态。
export async function updateAdminStatus(
  id: number,
  status: SystemAdminApi.Status,
  twoStep?: { twoStepKey?: string; twoStepValue?: string },
) {
  return requestClient.patch(`/admins/status/${id}`, { status, ...twoStep });
}

// resetAdminPassword 重置管理员密码。
export async function resetAdminPassword(
  id: number,
  password: string,
  twoStep?: { twoStepKey?: string; twoStepValue?: string },
) {
  return requestClient.post(`/admins/password/reset/${id}`, {
    password,
    ...twoStep,
  });
}

// resetAdminInitialState 重置管理员到首次登录前状态。
export async function resetAdminInitialState(
  id: number,
  password: string,
  twoStep?: { twoStepKey?: string; twoStepValue?: string },
) {
  return requestClient.post(`/admins/initial-state/reset/${id}`, {
    password,
    ...twoStep,
  });
}

// fetchAdminRoles 查询管理员已绑定角色。
export async function fetchAdminRoles(id: number) {
  return requestClient.get<SystemAdminApi.RoleItem[]>(`/admins/roles/${id}`);
}

// updateAdminRoles 覆盖保存管理员角色。
export async function updateAdminRoles(
  id: number,
  roleIDs: number[],
  payload?: Pick<SystemAdminApi.SaveParams, 'twoStepKey' | 'twoStepValue'>,
) {
  return requestClient.patch(`/admins/roles/${id}`, { roleIDs, ...payload });
}

// fetchRoleList 分页查询角色列表。
export async function fetchRoleList(params: SystemRoleApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<SystemRoleApi.Item>>('/roles', {
    params,
  });
}

// fetchRoleTree 查询角色树。
export async function fetchRoleTree() {
  return requestClient.get<SystemRoleApi.Item[]>('/roles/tree');
}

// fetchRoleTreeOptions 查询角色树下拉，适用于用户管理等只要求登录态合法的选择场景。
export async function fetchRoleTreeOptions() {
  return requestClient.get<SystemRoleApi.Item[]>('/roles/tree-options');
}

// createRole 新增角色。
export async function createRole(data: SystemRoleApi.SaveParams) {
  return requestClient.post('/roles', data);
}

// updateRole 编辑角色。
export async function updateRole(id: number, data: SystemRoleApi.SaveParams) {
  return requestClient.patch(`/roles/${id}`, data);
}

// deleteRole 删除角色。
export async function deleteRole(id: number) {
  return requestClient.delete(`/roles/${id}`);
}

// updateRoleStatus 修改角色状态。
export async function updateRoleStatus(
  id: number,
  status: SystemRoleApi.Status,
) {
  return requestClient.patch(`/roles/status/${id}`, { status });
}

// fetchRolePermissionTree 查询角色权限树，checked 字段表示已授权。
export async function fetchRolePermissionTree(id: number, isPid = false) {
  return requestClient.get<SystemPermissionApi.Item[]>(
    `/roles/permissions/tree/${id}/${isPid ? 'y' : 'n'}`,
  );
}

// updateRolePermissions 覆盖保存角色权限。
export async function updateRolePermissions(id: number, permissions: number[]) {
  return requestClient.patch(`/roles/permissions/${id}`, { permissions });
}

// fetchPermissionList 分页查询权限列表。
export async function fetchPermissionList(
  params: SystemPermissionApi.ListParams,
) {
  return requestClient.get<CommonApi.ListResult<SystemPermissionApi.Item>>(
    '/permissions',
    {
      params,
    },
  );
}

// fetchPermissionTree 查询权限树。
export async function fetchPermissionTree() {
  return requestClient.get<SystemPermissionApi.Item[]>('/permissions/tree');
}

// fetchPermissionMaxUuid 查询下一个权限标识。
export async function fetchPermissionMaxUuid() {
  return requestClient.get<SystemPermissionApi.MaxUuidResp>(
    '/permissions/max-uuid',
  );
}

// createPermission 新增权限。
export async function createPermission(data: SystemPermissionApi.SaveParams) {
  return requestClient.post('/permissions', data);
}

// updatePermission 编辑权限。
export async function updatePermission(
  id: number,
  data: SystemPermissionApi.SaveParams,
) {
  return requestClient.patch(`/permissions/${id}`, data);
}

// deletePermission 删除权限。
export async function deletePermission(id: number) {
  return requestClient.delete(`/permissions/${id}`);
}

// updatePermissionStatus 修改权限状态。
export async function updatePermissionStatus(
  id: number,
  status: SystemPermissionApi.Status,
) {
  return requestClient.patch(`/permissions/status/${id}`, { status });
}

// fetchConfigList 分页查询字典配置。
export async function fetchConfigList(params: SystemConfigApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<SystemConfigApi.Item>>(
    '/dicts',
    {
      params,
    },
  );
}

// createConfig 新增字典配置。
export async function createConfig(data: SystemConfigApi.SaveParams) {
  return requestClient.post('/dicts', data);
}

// downloadConfigExcel 导出字典配置 Excel。
export async function downloadConfigExcel(params: SystemConfigApi.ListParams) {
  return requestClient.download<Blob>('/dicts/export', {
    params,
  });
}

// importConfigExcel 导入字典配置 Excel。
export async function importConfigExcel(
  uploadIdOrPayload: string | { fileUrl?: string; uploadId?: string },
) {
  const payload =
    typeof uploadIdOrPayload === 'string'
      ? { uploadId: uploadIdOrPayload }
      : uploadIdOrPayload;
  return requestClient.post<SystemConfigApi.ImportResp>('/dicts/import', {
    ...payload,
  });
}

// updateConfig 编辑字典配置。
export async function updateConfig(
  id: number,
  data: SystemConfigApi.SaveParams,
) {
  return requestClient.patch(`/dicts/${id}`, data);
}

// fetchConfigCache 查看字典配置缓存。
export async function fetchConfigCache(uuid: string) {
  return requestClient.get(`/dicts/cache/${uuid}`);
}

// renewConfigCache 刷新字典配置缓存。
export async function renewConfigCache(uuid: string) {
  return requestClient.post(`/dicts/cache/refresh/${uuid}`);
}

// fetchCacheList 查询系统内置可刷新缓存列表。
export async function fetchCacheList(params?: { key?: string }) {
  return requestClient.get<CommonApi.ListResult<SystemCacheApi.Item>>(
    '/caches',
    {
      params,
    },
  );
}

// fetchCacheServerInfo 查询 Redis 服务信息。
export async function fetchCacheServerInfo() {
  return requestClient.get<SystemCacheApi.ServerInfo>('/caches/server-info');
}

// fetchCacheKeyInfo 查询 Redis Key 详情。
export async function fetchCacheKeyInfo(key: string) {
  return requestClient.get<SystemCacheApi.KeyInfo>('/caches/key-info', {
    params: { key },
  });
}

// normalizeCacheSearchResp 兼容后端历史数组响应和当前分页对象响应。
function normalizeCacheSearchResp(
  resp: SystemCacheApi.SearchItem[] | SystemCacheApi.SearchResp,
  fallbackPage = 1,
  fallbackPageSize = 20,
): SystemCacheApi.SearchResp {
  if (Array.isArray(resp)) {
    return {
      hasMore: false,
      list: resp,
      page: fallbackPage,
      pageSize: fallbackPageSize,
      total: resp.length,
    };
  }
  return {
    hasMore: !!resp.hasMore,
    list: resp.list || [],
    page: resp.page || fallbackPage,
    pageSize: resp.pageSize || fallbackPageSize,
    total: Number(resp.total || 0),
    nextPage: resp.nextPage,
    searchPath: resp.searchPath,
    providerName: resp.providerName,
    templateKey: resp.templateKey,
    candidateTotal: resp.candidateTotal,
    existingTotal: resp.existingTotal,
    limited: resp.limited,
    maxResults: resp.maxResults,
  };
}

// searchCacheKeys 搜索 Redis Key 列表，默认按分页方式返回，避免前端一次拉取过多 Key。
export async function searchCacheKeys(params: SystemCacheApi.SearchParams) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const resp = await requestClient.get<
    SystemCacheApi.SearchItem[] | SystemCacheApi.SearchResp
  >('/caches/keys', {
    params: { ...params, page, pageSize },
  });
  return normalizeCacheSearchResp(resp, page, pageSize);
}

// fetchSearchCacheKeyInfo 查询搜索结果中的 Redis Key 详情。
export async function fetchSearchCacheKeyInfo(key: string) {
  return requestClient.get<SystemCacheApi.KeyInfo>('/caches/key-info/search', {
    params: { key },
  });
}

// renewCache 刷新指定缓存。
export async function renewCache(key: string, type?: string) {
  return requestClient.post('/caches/refresh', { key, type });
}

// renewAllCache 刷新全部系统内置缓存。
export async function renewAllCache() {
  return requestClient.post('/caches/refresh-all');
}

// warmupCacheTemplate 按模板预热缓存实例，解决模板 key 在 Redis 未命中时无法全量刷新的问题。
export async function warmupCacheTemplate(templateKey: string, limit?: number) {
  return requestClient.post<SystemCacheApi.WarmupResp>('/caches/warmup', {
    templateKey,
    limit,
  });
}

// fetchAdminLogList 分页查询后台操作日志。
export async function fetchAdminLogList(params: SystemAdminLogApi.ListParams) {
  return requestClient.get<CommonApi.ListResult<SystemAdminLogApi.Item>>(
    '/admin-logs',
    {
      params,
    },
  );
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
  params?: { keyVersion?: string; twoStepKey?: string; twoStepValue?: string },
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
  twoStep?: { twoStepKey?: string; twoStepValue?: string },
) {
  return requestClient.patch(`/secret-keys/status/${id}`, {
    status,
    ...twoStep,
  });
}

// renewSecretKeyCache 刷新指定 AppID 的秘钥缓存。
export async function renewSecretKeyCache(
  uuid: string,
  twoStep?: { twoStepKey?: string; twoStepValue?: string },
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
  payload?: { keyVersion?: string; twoStepKey?: string; twoStepValue?: string },
) {
  return requestClient.post<SystemSecretKeyApi.CheckResult>(
    `/secret-keys/self-check/${uuid}`,
    {
      ...payload,
    },
  );
}

// debugSecuritySign 模拟请求或响应参数签名。
export async function debugSecuritySign(
  data: SystemSecurityDebugApi.SignParams,
) {
  return requestClient.post<SystemSecurityDebugApi.SignResult>(
    '/security/debug/sign',
    data,
  );
}

// debugSecurityVerify 模拟请求或响应参数验签。
export async function debugSecurityVerify(
  data: SystemSecurityDebugApi.VerifyParams,
) {
  return requestClient.post<SystemSecurityDebugApi.VerifyResult>(
    '/security/debug/verify',
    data,
  );
}

// debugSecurityEncrypt 模拟请求或响应参数加密。
export async function debugSecurityEncrypt(
  data: SystemSecurityDebugApi.CipherParams,
) {
  return requestClient.post<SystemSecurityDebugApi.CipherResult>(
    '/security/debug/encrypt',
    data,
  );
}

// debugSecurityDecrypt 模拟请求或响应参数解密。
export async function debugSecurityDecrypt(
  data: SystemSecurityDebugApi.CipherParams,
) {
  return requestClient.post<SystemSecurityDebugApi.CipherResult>(
    '/security/debug/decrypt',
    data,
  );
}

// fetchProfileInfo 查询当前登录管理员资料。
export async function fetchProfileInfo() {
  return requestClient.get<SystemProfileApi.Item>('/admin/mine');
}

// updateProfileInfo 更新当前登录管理员基础资料。
export async function updateProfileInfo(
  data: SystemProfileApi.UpdateMineParams,
) {
  return requestClient.post('/admin/updateMine', data);
}

// updateProfilePassword 修改当前登录管理员密码。
export async function updateProfilePassword(
  data: SystemProfileApi.UpdatePasswordParams,
) {
  return requestClient.post('/admin/updatePassword', data);
}

// updateProfileMfaStatus 修改当前登录管理员MFA状态。
export async function updateProfileMfaStatus(
  data: SystemProfileApi.UpdateMfaStatusParams,
) {
  return requestClient.post('/admin/updateMfaStatus', data);
}

// refreshProfileMfaSecretKey 重新生成当前登录管理员 MFA 秘钥。
export async function refreshProfileMfaSecretKey(data?: {
  twoStepKey?: string;
  twoStepValue?: string;
}) {
  return requestClient.post<SystemProfileApi.RefreshMfaSecretResp>(
    '/admin/refreshMfaSecretKey',
    data || {},
  );
}
