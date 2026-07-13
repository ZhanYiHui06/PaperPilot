import { useState, useCallback, memo } from 'react';
import { FormModal, Input, Select, TextArea, toast, Button } from '@lobehub/ui';
import type { FormItemProps } from '@lobehub/ui';
import { Form } from 'antd';
import { FileText, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from 'antd-style';
import { useExperimentStore } from './store';
import { EXPERIMENT_TYPE_META } from './ExperimentCard';
import { ExperimentResultsEditor } from './ExperimentResultsEditor';
import type { ExperimentResultTable } from './ExperimentResultsEditor';
import { FileDropZone } from '@renderer/components/shared/FileDropZone';
import type { Experiment, ExperimentType, ParsedExperimentData } from '@shared/types';

interface AddExperimentModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

interface AddExperimentFormValues {
  name: string;
  experiment_type: ExperimentType;
  dataset?: string;
  results?: ExperimentResultTable | null;
  notes?: string;
}

type FileStatus = 'parsing' | 'done' | 'error';

interface UploadedLogFile {
  name: string;
  content: string;
  status: FileStatus;
  parsed?: ParsedExperimentData;
}

const TYPE_OPTIONS: Array<{ label: string; value: ExperimentType }> = (
  Object.keys(EXPERIMENT_TYPE_META) as ExperimentType[]
).map((key) => ({
  label: EXPERIMENT_TYPE_META[key].label,
  value: key,
}));

/**
 * Merge multiple parsed experiment results into a single unified table.
 * - dataset: first non-null (or join if multiple distinct values)
 * - metric_names: union, preserving first-seen order
 * - methods: combine all methods, aligning values by the merged metric_names
 */
function mergeParsedData(results: ParsedExperimentData[]): {
  dataset: string | null;
  metric_names: string[];
  methods: Array<{ name: string; values: string[] }>;
} {
  // Dataset
  const datasets = results.map((r) => r.dataset).filter((d): d is string => !!d);
  const uniqueDatasets = [...new Set(datasets)];
  const dataset = uniqueDatasets.length === 0 ? null : uniqueDatasets.join(', ');

  // Metric names: union preserving first-seen order
  const metric_names: string[] = [];
  for (const r of results) {
    for (const m of r.metric_names) {
      if (!metric_names.includes(m)) metric_names.push(m);
    }
  }

  // Methods: combine all, align values by merged metric_names
  const methods: Array<{ name: string; values: string[] }> = [];
  for (const r of results) {
    for (const method of r.methods) {
      const values = metric_names.map((metric) => {
        const idx = r.metric_names.indexOf(metric);
        return idx >= 0 ? (method.values[idx] ?? '') : '';
      });
      methods.push({ name: method.name, values });
    }
  }

  return { dataset, metric_names, methods };
}

function AddExperimentModal({
  projectId,
  open,
  onClose,
}: AddExperimentModalProps): React.ReactElement {
  const [form] = Form.useForm<AddExperimentFormValues>();
  const [isCreating, setIsCreating] = useState(false);
  const [logFiles, setLogFiles] = useState<UploadedLogFile[]>([]);
  const addExperiment = useExperimentStore((s) => s.addExperiment);

  const applyMergedResults = useCallback(
    (files: UploadedLogFile[]) => {
      const parsed = files
        .filter((f) => f.status === 'done' && f.parsed)
        .map((f) => f.parsed!) as ParsedExperimentData[];

      if (parsed.length === 0) return;

      const merged = mergeParsedData(parsed);
      if (merged.metric_names.length === 0 && merged.methods.length === 0) return;

      form.setFieldsValue({
        dataset: merged.dataset ?? form.getFieldValue('dataset') ?? '',
        results: {
          metric_names: merged.metric_names,
          methods: merged.methods,
        },
      });
    },
    [form],
  );

  const handleFilesUpload = useCallback(
    async (files: Array<{ name: string; content: string }>) => {
      // Add all files with 'parsing' status
      const newFiles: UploadedLogFile[] = files.map((f) => ({
        name: f.name,
        content: f.content,
        status: 'parsing' as FileStatus,
      }));

      setLogFiles((prev) => [...prev, ...newFiles]);

      // Parse each file via LLM in parallel
      const parsePromises = newFiles.map(async (file) => {
        try {
          const parsed: ParsedExperimentData = await window.api.llm.parseExperiment(file.content);
          setLogFiles((prev) => {
            const updated = [...prev];
            // Find this file by name+content (since indices may shift if files are removed)
            const fileIndex = updated.findIndex(
              (f) => f.name === file.name && f.content === file.content && f.status === 'parsing',
            );
            if (fileIndex >= 0) {
              updated[fileIndex] = { ...updated[fileIndex], status: 'done', parsed };
            }
            // Re-apply merged results after each file finishes
            applyMergedResults(updated);
            return updated;
          });

          if (parsed.metric_names.length === 0 && parsed.methods.length === 0) {
            toast.warning({
              title: `${file.name} 未能解析出数据`,
              description: '未找到可识别的实验结果',
            });
          }
        } catch (e: unknown) {
          setLogFiles((prev) => {
            const updated = [...prev];
            const fileIndex = updated.findIndex(
              (f) => f.name === file.name && f.content === file.content && f.status === 'parsing',
            );
            if (fileIndex >= 0) {
              updated[fileIndex] = { ...updated[fileIndex], status: 'error' };
            }
            return updated;
          });
          toast.error({
            title: `${file.name} 解析失败`,
            description: e instanceof Error ? e.message : String(e),
          });
        }
      });

      await Promise.all(parsePromises);

      // Final success toast
      const successCount = files.length;
      if (successCount > 1) {
        toast.success({
          title: `已解析 ${successCount} 个日志文件`,
          description: '实验结果已合并填充',
        });
      }
    },
    [applyMergedResults],
  );

  const removeFile = useCallback(
    (index: number) => {
      setLogFiles((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        applyMergedResults(updated);
        return updated;
      });
    },
    [applyMergedResults],
  );

  const handleFinish = async (values: AddExperimentFormValues): Promise<void> => {
    setIsCreating(true);
    try {
      const metricsJson = values.results ?? null;
      const input: Partial<Experiment> = {
        project_id: projectId,
        name: values.name?.trim() ?? '',
        experiment_type: values.experiment_type ?? 'other',
        dataset: values.dataset?.trim() || null,
        model: null,
        hyperparameters: null,
        metrics: metricsJson as Record<string, unknown> | null,
        notes: values.notes?.trim() || null,
      };
      await addExperiment(input);
      toast.success({ title: '实验已创建' });
      form.resetFields();
      setLogFiles([]);
      onClose();
    } catch (e: unknown) {
      toast.error({
        title: '创建实验失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = (): void => {
    form.resetFields();
    setLogFiles([]);
    onClose();
  };

  const anyParsing = logFiles.some((f) => f.status === 'parsing');

  const items: FormItemProps[] = [
    {
      label: '实验名称',
      name: 'name',
      rules: [{ required: true, message: '请输入实验名称' }],
      children: <Input placeholder="输入实验名称" maxLength={200} autoFocus />,
    },
    {
      label: '实验类型',
      name: 'experiment_type',
      rules: [{ required: true, message: '请选择实验类型' }],
      initialValue: 'other' as ExperimentType,
      children: <Select options={TYPE_OPTIONS} placeholder="选择实验类型" />,
    },
    {
      label: '数据集',
      name: 'dataset',
      children: <Input placeholder="如 ImageNet, COCO, GLUE" />,
      desc: '本次实验使用的数据集',
    },
    {
      label: '实验结果',
      name: 'results',
      children: <ExperimentResultsEditor />,
      desc: '在数据集上跑多个方法 × 多个指标的结果矩阵',
    },
    {
      label: '上传实验日志',
      name: '_logUpload',
      children: (
        <MultiFileUploadSection
          logFiles={logFiles}
          parsing={anyParsing}
          onFilesContent={handleFilesUpload}
          onRemove={removeFile}
        />
      ),
      desc: '支持同时上传多个日志文件，AI 将分别解析并合并填充实验结果',
    },
    {
      label: '备注',
      name: 'notes',
      children: <TextArea rows={3} placeholder="实验观察、特殊设置或其他说明" />,
    },
  ];

  return (
    <FormModal
      open={open}
      title="新建实验"
      width={620}
      centered
      submitText="创建实验"
      submitLoading={isCreating}
      onCancel={handleClose}
      onFinish={handleFinish}
      mask={{ closable: false }}
      forceRender
      itemsType="flat"
      layout="vertical"
      form={form}
      items={items}
    />
  );
}

// --- Multi-file upload section with file list and status indicators ---

interface MultiFileUploadSectionProps {
  logFiles: UploadedLogFile[];
  parsing: boolean;
  onFilesContent: (files: Array<{ name: string; content: string }>) => void;
  onRemove: (index: number) => void;
}

const STATUS_ICON: Record<FileStatus, React.ReactElement> = {
  parsing: <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />,
  done: <CheckCircle2 size={14} />,
  error: <AlertCircle size={14} />,
};

const STATUS_COLOR: Record<FileStatus, string> = {
  parsing: 'var(--colorPrimary)',
  done: 'var(--colorSuccess)',
  error: 'var(--colorError)',
};

const MultiFileUploadSection = memo(function MultiFileUploadSection({
  logFiles,
  parsing,
  onFilesContent,
  onRemove,
}: MultiFileUploadSectionProps): React.ReactElement {
  const theme = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {logFiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logFiles.map((file, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${theme.colorBorderSecondary}`,
                background: theme.colorFillQuaternary,
              }}
            >
              <FileText size={14} style={{ color: theme.colorTextTertiary, flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: theme.colorText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: STATUS_COLOR[file.status],
                  flexShrink: 0,
                }}
              >
                {STATUS_ICON[file.status]}
                {file.status === 'parsing' ? '解析中' : file.status === 'done' ? '已解析' : '失败'}
              </span>
              <Button
                icon={<X size={14} />}
                type="text"
                size="small"
                onClick={() => onRemove(index)}
                style={{ flexShrink: 0 }}
              />
            </div>
          ))}
        </div>
      )}

      <FileDropZone
        accept=".txt,.log,.csv,.json,.out"
        multiple
        loading={parsing}
        description={logFiles.length === 0 ? '拖拽实验日志文件到此处，或点击选择' : '继续上传更多文件'}
        hint="支持同时选择多个文件，AI 将分别解析并合并结果"
        onFilesContent={onFilesContent}
      />
    </div>
  );
});

export { AddExperimentModal };
