import { FormModal, Input, Select, TextArea, toast } from '@lobehub/ui';
import { Form } from 'antd';
import { useEffect, useState } from 'react';
import { useProjectStore } from '@renderer/stores/projectStore';
import type { Project } from '@shared/types';

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

interface EditProjectFormValues {
  title: string;
  description?: string;
  target_venue?: string;
  tags?: string[];
}

export function EditProjectModal({ open, onClose, project }: EditProjectModalProps): React.ReactElement {
  const [isSaving, setIsSaving] = useState(false);
  const updateProject = useProjectStore((s) => s.updateProject);
  const [form] = Form.useForm<EditProjectFormValues>();
  const [modalKey, setModalKey] = useState(0);

  // When opening with a project, bump the key to force a fresh form mount
  // and set fields after fields are registered (next tick).
  useEffect(() => {
    if (open && project) {
      setModalKey((k) => k + 1);
      // Defer setFieldsValue to ensure form fields are registered after remount
      const raf = requestAnimationFrame(() => {
        form.setFieldsValue({
          title: project.title,
          description: project.description ?? undefined,
          target_venue: project.target_venue ?? undefined,
          tags: project.tags ?? [],
        });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open, project, form]);

  const handleFinish = async (values: EditProjectFormValues): Promise<void> => {
    if (!project) return;
    setIsSaving(true);
    try {
      const tags = Array.isArray(values.tags)
        ? values.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        : [];
      await updateProject(project.id, {
        title: values.title?.trim() ?? '',
        description: values.description?.trim() || null,
        target_venue: values.target_venue?.trim() || null,
        tags,
      });
      toast.success({ title: '项目信息已更新' });
      onClose();
    } catch (e: unknown) {
      toast.error({
        title: '保存失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      key={modalKey}
      open={open}
      title="编辑项目信息"
      width={560}
      centered
      submitText="保存修改"
      submitLoading={isSaving}
      onCancel={onClose}
      onFinish={handleFinish}
      form={form}
      mask={{ closable: false }}
      destroyOnHidden
      itemsType="flat"
      layout="vertical"
      classNames={{ form: 'create-project-form' }}
      initialValues={{
        title: project?.title ?? '',
        description: project?.description ?? undefined,
        target_venue: project?.target_venue ?? undefined,
        tags: project?.tags ?? [],
      }}
      items={[
        {
          label: '论文标题',
          name: 'title',
          rules: [{ required: true, message: '请输入论文标题' }],
          children: <Input placeholder="输入论文标题" maxLength={200} autoFocus />,
        },
        {
          label: '论文描述',
          name: 'description',
          children: <TextArea rows={4} placeholder="简要描述研究方向、创新点或论文摘要" />,
        },
        {
          label: '目标期刊/会议',
          name: 'target_venue',
          children: <Input placeholder="如 AAAI 2027, CVPR 2026" />,
          desc: '将显示在项目卡片的 Target 标签上',
        },
        {
          label: '领域/主题标签',
          name: 'tags',
          children: (
            <Select mode="tags" placeholder="输入关键词后按回车添加" tokenSeparators={[',']} />
          ),
          desc: '支持自定义新增领域、研究主题类标签',
        },
      ]}
    />
  );
}
