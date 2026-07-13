import { useState } from 'react';
import { FormModal, Input, toast } from '@lobehub/ui';
import { Form } from 'antd';
import { useLatexEditorStore } from './store';

interface SaveVersionModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

interface SaveVersionFormValues {
  version_label: string;
}

export function SaveVersionModal({
  projectId,
  open,
  onClose,
}: SaveVersionModalProps): React.ReactElement {
  const [form] = Form.useForm<SaveVersionFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const saveVersion = useLatexEditorStore((s) => s.saveVersion);
  const editorContent = useLatexEditorStore((s) => s.editorContent);

  const handleFinish = async (values: SaveVersionFormValues): Promise<void> => {
    setSubmitting(true);
    try {
      const label = values.version_label?.trim() ?? '';
      if (!label) {
        toast.error({ title: '请输入版本名称' });
        return;
      }
      await saveVersion(projectId, label, editorContent);
      toast.success({ title: '版本已保存' });
      form.resetFields();
      onClose();
    } catch (e: unknown) {
      toast.error({
        title: '保存版本失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (): void => {
    form.resetFields();
    onClose();
  };

  return (
    <FormModal
      open={open}
      title="记录 LaTeX 版本"
      width={480}
      centered
      submitText="记录版本"
      submitLoading={submitting}
      onCancel={handleClose}
      onFinish={handleFinish}
      mask={{ closable: false }}
      forceRender
      itemsType="flat"
      layout="vertical"
      form={form}
      styles={{ body: { paddingTop: 28 } }}
      items={[
        {
          label: (
            <span>
              版本名称 <span style={{ color: '#ff4d4f' }}>*</span>
            </span>
          ),
          name: 'version_label',
          rules: [
            {
              validator: (_, value) =>
                value?.trim() ? Promise.resolve() : Promise.reject(new Error('请输入版本名称')),
            },
          ],
          children: (
            <Input placeholder="如：初稿 / 投稿前修订 / camera-ready" maxLength={120} autoFocus />
          ),
          desc: '记录后系统将调用 LLM 生成 AI 摘要',
        },
      ]}
    />
  );
}
