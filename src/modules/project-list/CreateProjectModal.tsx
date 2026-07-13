import { FormModal, Input, Select, TextArea, toast } from '@lobehub/ui';
import { useProjectStore } from '@renderer/stores/projectStore';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { CreateProjectInput } from '@shared/types';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

interface CreateProjectFormValues {
  title: string;
  description?: string;
  target_venue?: string;
  tags?: string[];
}

export function CreateProjectModal({ open, onClose }: CreateProjectModalProps): React.ReactElement {
  const [isCreating, setIsCreating] = useState(false);
  const createProject = useProjectStore((s) => s.createProject);
  const navigate = useNavigate();

  const handleFinish = async (values: CreateProjectFormValues): Promise<void> => {
    setIsCreating(true);
    try {
      const tags = Array.isArray(values.tags)
        ? values.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        : [];
      const input: CreateProjectInput = {
        title: values.title?.trim() ?? '',
        description: values.description?.trim() || undefined,
        target_venue: values.target_venue?.trim() || undefined,
        tags,
      };
      const newProject = await createProject(input);
      toast.success({ title: '项目创建成功' });
      onClose();
      navigate(`/project/${newProject.id}`);
    } catch (e: unknown) {
      toast.error({
        title: '项目创建失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormModal
      open={open}
      title="新建项目"
      width={560}
      centered
      className="create-project-modal"
      submitText="创建项目"
      submitLoading={isCreating}
      onCancel={onClose}
      onFinish={handleFinish}
      mask={{ closable: false }}
      destroyOnHidden
      itemsType="flat"
      layout="vertical"
      classNames={{ form: 'create-project-form' }}
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
