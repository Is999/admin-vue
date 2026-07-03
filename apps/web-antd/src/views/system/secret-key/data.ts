import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemSecretKeyApi } from '#/api/system';

import { z } from '#/adapter/form';
import { buildClampTextColumn } from '#/adapter/vxe-table';
import {
  asActionPermission,
  SYSTEM_ACTION_PERMISSION_CODES,
} from '#/constants/permission-codes';
import { $t } from '#/locales';

import {
  countTagMeta,
  enabledStatusTagMap,
  grayPercentTagMeta,
} from '../table-tags';

// absolutePathRule 约束秘钥输入必须是绝对路径，不允许直接录入明文或 PEM。
function absolutePathRule() {
  return z
    .string()
    .optional()
    .refine((value) => !String(value || '').includes('-----BEGIN'), {
      message: $t('business.message.secretOnlyAbsolutePathNoPem'),
    })
    .refine(
      (value) => {
        const text = String(value || '').trim();
        if (!text) {
          return true;
        }
        return text.startsWith('/') || /^[A-Z]:[\\/]/i.test(text);
      },
      { message: $t('business.message.secretAbsolutePathRequired') },
    );
}

// statusOptions 返回秘钥启用状态选项，避免语言切换后沿用模块初始化时的旧文案。
function statusOptions() {
  return [
    { label: $t('business.message.enable'), value: 1 },
    { label: $t('business.message.disable'), value: 0 },
  ];
}

// useFormSchema 返回秘钥新增与编辑表单配置。
export function useFormSchema(disabledUUID = false): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'uuid',
      help: $t('business.message.secretUuidHelp'),
      label: $t('business.message.secretUuid'),
      rules: 'required',
      componentProps: {
        disabled: disabledUUID,
        placeholder: disabledUUID
          ? $t('business.message.secretUuidLockedPlaceholder')
          : $t('business.message.secretUuidPlaceholder'),
      },
    },
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.secretTitle'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'keyVersion',
      help: $t('business.message.secretKeyVersionHelp'),
      label: $t('business.message.secretCurrentVersion'),
      rules: 'required',
      componentProps: {
        placeholder: $t('business.message.secretKeyVersionPlaceholder'),
      },
    },
    {
      component: 'RadioGroup',
      defaultValue: 0,
      fieldName: 'status',
      label: $t('business.message.secretStatus'),
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions(),
        optionType: 'button',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'RadioGroup',
      defaultValue: 1,
      fieldName: 'signStatus',
      help: $t('business.message.secretSignStatusHelp'),
      label: $t('business.message.secretSignStatus'),
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions(),
        optionType: 'button',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'RadioGroup',
      defaultValue: 1,
      fieldName: 'cryptoStatus',
      help: $t('business.message.secretCryptoStatusHelp'),
      label: $t('business.message.secretCryptoStatus'),
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions(),
        optionType: 'button',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'RadioGroup',
      defaultValue: 0,
      fieldName: 'versionStatus',
      label: $t('business.message.secretVersionStatus'),
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions(),
        optionType: 'button',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Input',
      fieldName: 'stableVersion',
      help: $t('business.message.secretStableVersionHelp'),
      label: $t('business.message.secretStableVersion'),
      componentProps: {
        placeholder: $t('business.message.secretStableVersionPlaceholder'),
      },
    },
    {
      component: 'Input',
      fieldName: 'grayVersion',
      help: $t('business.message.secretGrayVersionHelp'),
      label: $t('business.message.secretGrayVersion'),
      componentProps: {
        placeholder: $t('business.message.secretGrayVersionPlaceholder'),
      },
    },
    {
      component: 'InputNumber',
      defaultValue: 0,
      fieldName: 'grayPercent',
      help: $t('business.message.secretGrayPercentHelp'),
      label: $t('business.message.secretGrayTrafficPercent'),
      componentProps: {
        min: 0,
        max: 100,
        precision: 0,
        placeholder: '0-100',
        style: { width: '100%' },
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('business.message.remarkDescription'),
      componentProps: {
        autoSize: { minRows: 4, maxRows: 8 },
        maxlength: 255,
        showCount: true,
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Input',
      fieldName: 'aesKeyRef',
      help: $t('business.message.secretAesKeyRefHelp'),
      label: $t('business.message.secretAesKeyPath'),
      rules: absolutePathRule(),
      componentProps: {
        placeholder: '/etc/admin/keys/<uuid>/aes_key',
      },
    },
    {
      component: 'Input',
      fieldName: 'aesIvRef',
      help: $t('business.message.secretAesIvRefHelp'),
      label: $t('business.message.secretAesIvPath'),
      rules: absolutePathRule(),
      componentProps: {
        placeholder: '/etc/admin/keys/<uuid>/aes_iv',
      },
    },
    {
      component: 'Input',
      fieldName: 'rsaPublicKeyServerRef',
      help: $t('business.message.secretServerPublicKeyHelp'),
      label: $t('business.message.secretServerPublicKeyPath'),
      rules: absolutePathRule(),
      componentProps: {
        placeholder: '/etc/admin/keys/<uuid>/server_public.pem',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Input',
      fieldName: 'rsaPrivateKeyServerRef',
      help: $t('business.message.secretServerPrivateKeyHelp'),
      label: $t('business.message.secretServerPrivateKeyPath'),
      rules: absolutePathRule(),
      componentProps: {
        placeholder: '/etc/admin/keys/<uuid>/server_private.pem',
      },
      formItemClass: 'col-span-1',
    },
    {
      component: 'Input',
      fieldName: 'rsaPublicKeyUserRef',
      help: $t('business.message.secretUserPublicKeyHelp'),
      label: $t('business.message.secretUserPublicKeyPath'),
      rules: absolutePathRule(),
      componentProps: {
        placeholder: '/etc/admin/keys/<uuid>/user_public.pem',
      },
      formItemClass: 'col-span-2',
    },
  ];
}

// useGridFormSchema 返回秘钥列表搜索表单配置。
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'uuid',
      label: $t('business.message.secretUuid'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByAppId'),
      },
    },
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('business.message.secretTitle'),
      componentProps: {
        allowClear: true,
        placeholder: $t('business.message.filterByTitle'),
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('business.message.secretStatus'),
      componentProps: {
        allowClear: true,
        options: statusOptions(),
        placeholder: $t('business.message.filterByStatus'),
      },
    },
    {
      component: 'Select',
      fieldName: 'signStatus',
      label: $t('business.message.secretSignStatus'),
      componentProps: {
        allowClear: true,
        options: statusOptions(),
        placeholder: $t('business.message.filterBySignStatus'),
      },
    },
    {
      component: 'Select',
      fieldName: 'cryptoStatus',
      label: $t('business.message.secretCryptoStatus'),
      componentProps: {
        allowClear: true,
        options: statusOptions(),
        placeholder: $t('business.message.filterByCryptoStatus'),
      },
    },
  ];
}

// maskSecretValue 对列表中的敏感值做脱敏展示。
export function maskSecretValue(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return '-';
  }
  const normalized = text.replaceAll('\\', '/');
  const segments = normalized.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] || normalized;
  if (fileName.length <= 8) {
    return `${fileName.slice(0, 2)}****`;
  }
  return `${fileName.slice(0, 4)}****${fileName.slice(-4)}`;
}

// useColumns 返回秘钥管理表格列配置。
export function useColumns<T = SystemSecretKeyApi.Item>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    {
      field: 'uuid',
      fixed: 'left',
      minWidth: 180,
      title: $t('business.message.secretUuid'),
    },
    {
      field: 'title',
      minWidth: 160,
      title: $t('business.message.secretTitle'),
    },
    {
      field: 'keyVersion',
      minWidth: 120,
      title: $t('business.message.secretCurrentVersion'),
    },
    {
      field: 'stableVersion',
      minWidth: 120,
      title: $t('business.message.secretStableVersion'),
    },
    {
      field: 'grayVersion',
      minWidth: 120,
      title: $t('business.message.secretGrayVersion'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: unknown }) => grayPercentTagMeta(value),
        },
        name: 'CellTag',
      },
      field: 'grayPercent',
      minWidth: 110,
      title: $t('business.message.secretGrayTrafficPercent'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: enabledStatusTagMap() },
        name: 'CellTag',
      },
      field: 'signStatus',
      minWidth: 100,
      title: $t('business.message.secretSignStatus'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: { tagMap: enabledStatusTagMap() },
        name: 'CellTag',
      },
      field: 'cryptoStatus',
      minWidth: 100,
      title: $t('business.message.secretCryptoStatus'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          getMeta: ({ value }: { value: unknown }) =>
            countTagMeta(value, 'processing'),
        },
        name: 'CellTag',
      },
      field: 'versionCount',
      minWidth: 100,
      title: $t('business.message.secretVersionCount'),
    },
    {
      field: 'aesKeyRef',
      formatter: ({ row }: { row: SystemSecretKeyApi.Item }) =>
        maskSecretValue(row.aesKeyRef),
      minWidth: 150,
      title: $t('business.message.secretAesKeyPath'),
    },
    {
      field: 'aesIvRef',
      formatter: ({ row }: { row: SystemSecretKeyApi.Item }) =>
        maskSecretValue(row.aesIvRef),
      minWidth: 130,
      title: $t('business.message.secretAesIvPath'),
    },
    {
      field: 'rsaPublicKeyUserRef',
      formatter: ({ row }: { row: SystemSecretKeyApi.Item }) =>
        maskSecretValue(row.rsaPublicKeyUserRef),
      minWidth: 160,
      title: $t('business.message.secretUserPublicKeyPath'),
    },
    {
      field: 'rsaPublicKeyServerRef',
      formatter: ({ row }: { row: SystemSecretKeyApi.Item }) =>
        maskSecretValue(row.rsaPublicKeyServerRef),
      minWidth: 170,
      title: $t('business.message.secretServerPublicKeyPath'),
    },
    {
      field: 'rsaPrivateKeyServerRef',
      formatter: ({ row }: { row: SystemSecretKeyApi.Item }) =>
        maskSecretValue(row.rsaPrivateKeyServerRef),
      minWidth: 170,
      title: $t('business.message.secretServerPrivateKeyPath'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          auth: asActionPermission(
            SYSTEM_ACTION_PERMISSION_CODES.SECRET_KEY_STATUS,
          ),
          beforeChange: onStatusChange,
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('business.message.status'),
      width: 140,
    },
    buildClampTextColumn({
      field: 'remark',
      minWidth: 220,
      title: $t('business.message.remark'),
    }),
    {
      field: 'updatedAt',
      minWidth: 170,
      title: $t('business.message.updatedAt'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'title',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'edit',
            icon: 'edit',
            iconOnly: true,
            text: $t('business.message.edit'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.SECRET_KEY_EDIT,
            ),
          },
          {
            code: 'cache',
            icon: 'search',
            iconOnly: true,
            text: $t('business.message.cacheManagement'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.CACHE_KEY_INFO,
            ),
          },
          {
            code: 'renew',
            icon: 'reload',
            iconOnly: true,
            text: $t('business.message.refreshCache'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.SECRET_KEY_RENEW,
            ),
          },
          {
            code: 'self-check',
            icon: 'check',
            iconOnly: true,
            text: $t('business.message.secretRunSelfCheck'),
            auth: asActionPermission(
              SYSTEM_ACTION_PERMISSION_CODES.SECRET_KEY_GET,
            ),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('business.message.operation'),
      width: 112,
    },
  ];
}
