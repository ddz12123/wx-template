import { checkHttpStatus, HttpClientError, networkError } from './errors';
import { createOperation, prepareNetworkOptions } from './helpers';
import type {
  AbortableOperation,
  NetworkOptions,
  OperationControl,
  ResolveContext,
} from './helpers';

export interface TransferProgress {
  progress: number;
  transferredBytes: number;
  totalBytes: number;
}

export interface TransferOperation<T> extends AbortableOperation<T> {
  /** 返回取消订阅函数；只发送后续进度，完成时释放所有订阅。观察者异常被隔离。 */
  onProgress(listener: (progress: TransferProgress) => void): () => void;
}

export interface UploadOptions extends NetworkOptions {
  filePath: string;
  /** multipart 文件字段名；不自动设置 Content-Type。 */
  name: string;
  formData?: Record<string, string | number | boolean>;
}

export interface ParsedUploadOptions<T> extends UploadOptions {
  /** 上传响应始终是原始文本；由调用方显式解析和校验。 */
  parse: (text: string) => T | Promise<T>;
}

export interface UploadResponse<T = string> {
  data: T;
  statusCode: number;
}

export interface DownloadOptions extends NetworkOptions {
  /** 省略则下载至微信临时文件；不自动持久化、打开或清理文件。 */
  filePath?: string;
}

export interface DownloadResponse {
  statusCode: number;
  /** 指定 filePath 时由微信返回该路径；不同基础库可能省略另一种路径。 */
  filePath?: string;
  tempFilePath?: string;
}

function createTransfer<T>(
  start: (control: OperationControl<T>, publish: (progress: TransferProgress) => void) => void,
): TransferOperation<T> {
  const listeners = new Set<(progress: TransferProgress) => void>();
  let finished = false;
  const operation = createOperation<T>((control) => {
    start(control, (progress) => {
      if (!control.active()) return;
      for (const listener of listeners) {
        if (!control.active()) break;
        try {
          listener(progress);
        } catch {
          /* 进度观察者不能改变传输结果。 */
        }
      }
    });
  });
  // 同时注册两条完成路径，避免 finally 派生出无人处理的拒绝 promise。
  const release = (): void => {
    finished = true;
    listeners.clear();
  };
  void operation.promise.then(release, release);
  return {
    ...operation,
    onProgress(listener) {
      if (!finished) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function uploadFile<T>(
  options: ParsedUploadOptions<T>,
  context?: ResolveContext,
): TransferOperation<UploadResponse<T>>;
export function uploadFile(
  options: UploadOptions,
  context?: ResolveContext,
): TransferOperation<UploadResponse<string>>;
export function uploadFile<T>(
  options: UploadOptions | ParsedUploadOptions<T>,
  context: ResolveContext = {},
): TransferOperation<UploadResponse<string | T>> {
  return createTransfer<UploadResponse<string | T>>((control, publish) => {
    if (!options.filePath || !options.name) {
      throw new HttpClientError('config', 'Upload requires filePath and name');
    }
    const network = prepareNetworkOptions(options, context);
    const parse = 'parse' in options ? options.parse : undefined;
    const task = wx.uploadFile({
      ...network,
      filePath: options.filePath,
      name: options.name,
      formData: options.formData,
      success(result) {
        if (!control.active()) return;
        void (async () => {
          checkHttpStatus(result);
          try {
            const data = parse ? await parse(result.data) : result.data;
            control.resolve({ data, statusCode: result.statusCode });
          } catch (cause) {
            control.reject(
              new HttpClientError('parse', 'Upload response parsing failed', {
                statusCode: result.statusCode,
                data: result.data,
                cause,
              }),
            );
          }
        })().catch((cause: unknown) => control.reject(networkError(cause)));
      },
      fail(cause) {
        control.reject(networkError(cause));
      },
    });
    control.attach(task);
    if (!control.active()) return;
    const onUploadProgress = (
      progress: WechatMiniprogram.UploadTaskOnProgressUpdateListenerResult,
    ): void => {
      publish({
        progress: progress.progress,
        transferredBytes: progress.totalBytesSent,
        totalBytes: progress.totalBytesExpectedToSend,
      });
    };
    control.onSettled(() => task.offProgressUpdate(onUploadProgress));
    task.onProgressUpdate(onUploadProgress);
  });
}

export function downloadFile(
  options: DownloadOptions,
  context: ResolveContext = {},
): TransferOperation<DownloadResponse> {
  return createTransfer<DownloadResponse>((control, publish) => {
    const network = prepareNetworkOptions(options, context);
    const task = wx.downloadFile({
      ...network,
      filePath: options.filePath,
      success(result) {
        if (!control.active()) return;
        try {
          checkHttpStatus(result);
          control.resolve({
            statusCode: result.statusCode,
            filePath: result.filePath,
            tempFilePath: result.tempFilePath,
          });
        } catch (cause) {
          control.reject(networkError(cause));
        }
      },
      fail(cause) {
        control.reject(networkError(cause));
      },
    });
    control.attach(task);
    if (!control.active()) return;
    const onDownloadProgress = (
      progress: WechatMiniprogram.DownloadTaskOnProgressUpdateListenerResult,
    ): void => {
      publish({
        progress: progress.progress,
        transferredBytes: progress.totalBytesWritten,
        totalBytes: progress.totalBytesExpectedToWrite,
      });
    };
    control.onSettled(() => task.offProgressUpdate(onDownloadProgress));
    task.onProgressUpdate(onDownloadProgress);
  });
}
