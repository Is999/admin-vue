import { h, ref, render } from 'vue';

import { VCropper } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Modal } from 'ant-design-vue';

type CropExportFormat = 'image/jpeg' | 'image/png';

interface CropExportOptions {
  format: CropExportFormat; // 输出图片格式，头像优先使用 JPEG 避免 PNG 重编码膨胀。
  quality: number; // 有损格式压缩质量，范围 0-1。
  targetHeight: number; // 输出目标高度，限制头像像素尺寸。
  targetWidth: number; // 输出目标宽度，限制头像像素尺寸。
}

// avatarCropExportOptions 约束头像裁剪输出，避免大图按 PNG 原尺寸导出后超过上传限制。
const avatarCropExportOptions: CropExportOptions = {
  format: 'image/jpeg',
  quality: 0.86,
  targetHeight: 512,
  targetWidth: 512,
};

// resolveDisplayFileURL 把相对文件地址转换为浏览器可直接访问的显示地址。
export function resolveDisplayFileURL(rawUrl?: string, baseURL?: string) {
  const normalizedUrl = String(rawUrl || '').trim();
  if (!normalizedUrl) {
    return '';
  }
  if (
    /^https?:\/\//i.test(normalizedUrl) ||
    normalizedUrl.startsWith('data:')
  ) {
    return normalizedUrl;
  }

  const normalizedBaseURL = String(baseURL || '').trim();
  const fallbackOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';

  try {
    if (normalizedBaseURL) {
      const resolvedURL = new URL(
        normalizedUrl,
        normalizeDisplayFileBaseURL(normalizedBaseURL, fallbackOrigin),
      );
      if (isInvalidManagedAccessURL(resolvedURL)) {
        return '';
      }
      return resolvedURL.toString();
    }
    const resolvedURL = new URL(normalizedUrl, fallbackOrigin);
    if (isInvalidManagedAccessURL(resolvedURL)) {
      return '';
    }
    return resolvedURL.toString();
  } catch {
    return normalizedUrl;
  }
}

// normalizeDisplayFileBaseURL 把 axios 的 baseURL 统一转换成可用于 URL 解析的绝对基址。
// 当前项目常用 `/api` 这类相对 baseURL；若直接传给 `new URL()` 会抛错，导致头像只保留相对路径。
function normalizeDisplayFileBaseURL(baseURL: string, fallbackOrigin: string) {
  const normalizedBaseURL = String(baseURL || '').trim();
  if (!normalizedBaseURL) {
    return fallbackOrigin;
  }
  if (/^https?:\/\//i.test(normalizedBaseURL)) {
    return normalizedBaseURL;
  }
  return new URL(normalizedBaseURL, fallbackOrigin).toString();
}

// isInvalidManagedAccessURL 判断统一文件访问地址是否缺少必要的 uploadId。
// 缺少 uploadId 时直接忽略，避免头像预览打出无效访问请求。
function isInvalidManagedAccessURL(url: URL) {
  const normalizedPath = String(url.pathname || '').trim();
  if (
    normalizedPath !== '/api/file-transfer/access' &&
    normalizedPath !== '/file-transfer/access'
  ) {
    return false;
  }
  return String(url.searchParams.get('uploadId') || '').trim() === '';
}

// cropAvatarFile 打开头像裁剪弹窗，并返回裁剪后的文件对象。
export async function cropAvatarFile(
  file: File,
  aspectRatio = '1:1',
): Promise<File | null> {
  const croppedResult = await openCropperDialog(
    file,
    aspectRatio,
    avatarCropExportOptions,
  );
  if (!croppedResult) {
    return null;
  }
  return blobToFile(croppedResult, file.name);
}

// openCropperDialog 打开图片裁剪弹窗，返回裁剪后的 Blob 图片结果。
function openCropperDialog(
  file: File,
  aspectRatio: string,
  exportOptions?: CropExportOptions,
) {
  return new Promise<Blob | null>((resolve, reject) => {
    const container = document.createElement('div');
    document.body.append(container);

    let destroyed = false;
    let objectURL: null | string = null;

    const open = ref(true);
    const cropperRef = ref<InstanceType<typeof VCropper> | null>(null);

    const destroy = () => {
      open.value = false;
      setTimeout(() => {
        if (destroyed) {
          return;
        }
        destroyed = true;
        if (objectURL) {
          URL.revokeObjectURL(objectURL);
        }
        render(null, container);
        container.remove();
      }, 300);
    };

    const CropperDialog = {
      setup() {
        return () => {
          if (destroyed) {
            return null;
          }
          if (!objectURL) {
            objectURL = URL.createObjectURL(file);
          }
          return h(
            Modal,
            {
              cancelText: $t('common.cancel'),
              centered: true,
              closable: false,
              destroyOnClose: true,
              keyboard: false,
              maskClosable: false,
              okText: $t('ui.crop.confirm'),
              onCancel() {
                resolve(null);
                destroy();
              },
              onOk: async () => {
                const cropper = cropperRef.value;
                if (!cropper) {
                  reject(new Error('Cropper not found'));
                  destroy();
                  return;
                }
                try {
                  const cropResult = await cropper.getCropImage(
                    exportOptions?.format,
                    exportOptions?.quality,
                    'blob',
                    exportOptions?.targetWidth,
                    exportOptions?.targetHeight,
                  );
                  if (!(cropResult instanceof Blob) || cropResult.size === 0) {
                    throw new Error($t('business.message.cropResultInvalid'));
                  }
                  resolve(cropResult);
                } catch {
                  reject(new Error($t('ui.crop.errorTip')));
                } finally {
                  destroy();
                }
              },
              open: open.value,
              title: h('div', {}, [
                $t('ui.crop.title'),
                h(
                  'span',
                  {
                    class: 'ml-2 text-sm font-normal text-gray-400',
                  },
                  $t('ui.crop.titleTip', [aspectRatio]),
                ),
              ]),
              width: 548,
            },
            () =>
              h(
                'div',
                {
                  class:
                    'h-[420px] overflow-hidden rounded-lg bg-black/5 dark:bg-white/5',
                },
                [
                  h(VCropper, {
                    ref: (currentRef: any) => (cropperRef.value = currentRef),
                    aspectRatio,
                    class: 'h-full w-full',
                    img: objectURL as string,
                  }),
                ],
              ),
          );
        };
      },
    };

    render(h(CropperDialog), container);
  });
}

// blobToFile 把 Blob 结果包装为 File，并尽量复用原始文件名后缀。
function blobToFile(blob: Blob, originalFileName: string) {
  const mimeType = String(blob.type || 'image/png').trim() || 'image/png';
  const extension = mimeType.split('/')[1] || 'png';
  const fileName = replaceFileExtension(originalFileName, extension);
  return new File([blob], fileName, { type: mimeType });
}

// replaceFileExtension 按裁剪后的 MIME 类型替换输出文件扩展名。
function replaceFileExtension(fileName: string, extension: string) {
  const normalizedFileName = String(fileName || 'avatar').trim() || 'avatar';
  const normalizedExtension = String(extension || 'png')
    .trim()
    .replace(/^\./, '');
  const dotIndex = normalizedFileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${normalizedFileName}.${normalizedExtension}`;
  }
  return `${normalizedFileName.slice(0, dotIndex)}.${normalizedExtension}`;
}
