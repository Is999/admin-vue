import { h, ref, render } from 'vue';

import { VCropper } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Modal } from 'ant-design-vue';

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
// 旧数据或异常回填若只剩 `/api/file-transfer/access`，浏览器继续请求只会打出参数错误日志。
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
  const croppedResult = await openCropperDialog(file, aspectRatio);
  if (!croppedResult) {
    return null;
  }
  return normalizeCropResultToFile(croppedResult, file.name);
}

// openCropperDialog 打开图片裁剪弹窗，返回裁剪后的图片结果。
// 兼容 VCropper 在不同版本下返回 data URL、Blob 或 File。
function openCropperDialog(file: File, aspectRatio: string) {
  return new Promise<Blob | File | string>((resolve, reject) => {
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
                resolve('');
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
                  const cropResult = await cropper.getCropImage();
                  resolve(cropResult || '');
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

// normalizeCropResultToFile 把裁剪组件返回值统一转换成 File，便于复用现有上传链路。
function normalizeCropResultToFile(
  cropResult: Blob | File | string,
  originalFileName: string,
) {
  if (cropResult instanceof File) {
    return ensureOutputFileName(cropResult, originalFileName);
  }
  if (cropResult instanceof Blob) {
    return blobToFile(cropResult, originalFileName);
  }
  return dataUrlToFile(cropResult, originalFileName);
}

// dataUrlToFile 把裁剪结果的 data URL 转成 File，便于复用现有上传链路。
function dataUrlToFile(dataUrl: string, originalFileName: string) {
  const normalizedDataUrl = String(dataUrl || '').trim();
  const matched = normalizedDataUrl.match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i,
  );
  if (!matched) {
    throw new Error($t('business.message.cropResultInvalid'));
  }
  const mimeType = matched[1] || 'image/png';
  const base64Text = matched[2] || '';
  const binaryText = globalThis.atob(base64Text);
  const bytes = new Uint8Array(binaryText.length);
  for (let index = 0; index < binaryText.length; index += 1) {
    bytes[index] = binaryText.codePointAt(index) || 0;
  }
  const extension = mimeType.split('/')[1] || 'png';
  const fileName = replaceFileExtension(originalFileName, extension);
  return new File([bytes], fileName, { type: mimeType });
}

// blobToFile 把 Blob 结果包装为 File，并尽量复用原始文件名后缀。
function blobToFile(blob: Blob, originalFileName: string) {
  const mimeType = String(blob.type || 'image/png').trim() || 'image/png';
  const extension = mimeType.split('/')[1] || 'png';
  const fileName = replaceFileExtension(originalFileName, extension);
  return new File([blob], fileName, { type: mimeType });
}

// ensureOutputFileName 确保裁剪组件直接返回 File 时，输出文件名和扩展名与当前上传链路一致。
function ensureOutputFileName(file: File, originalFileName: string) {
  const mimeType = String(file.type || 'image/png').trim() || 'image/png';
  const extension = mimeType.split('/')[1] || 'png';
  const expectedFileName = replaceFileExtension(originalFileName, extension);
  if (file.name === expectedFileName) {
    return file;
  }
  return new File([file], expectedFileName, { type: mimeType });
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
