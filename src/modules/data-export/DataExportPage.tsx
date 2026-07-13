﻿﻿﻿﻿import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Button, Segmented, toast } from '@lobehub/ui';
import { Card, Checkbox } from 'antd';
import { useTheme } from 'antd-style';
import { useParams } from 'react-router-dom';
import { Download, FileJson, FileText } from 'lucide-react';
import { pageVariants } from '@renderer/lib/motion';
import { matchesPaperTitle } from '../submission-manager/store';
import { exportToJSON, exportToMarkdown, type ExportData } from './exporters';

type ExportFormat = 'json' | 'markdown';

type ExportScope =
  | 'project'
  | 'progressNodes'
  | 'codeVersions'
  | 'experiments'
  | 'latexVersions'
  | 'emails';

const SCOPE_OPTIONS: Array<{ label: string; value: ExportScope }> = [
  { label: '项目信息', value: 'project' },
  { label: '进度节点', value: 'progressNodes' },
  { label: '代码版本', value: 'codeVersions' },
  { label: '实验', value: 'experiments' },
  { label: 'LaTeX 版本', value: 'latexVersions' },
  { label: '邮件', value: 'emails' },
];

const FORMAT_OPTIONS: Array<{ label: React.ReactNode; value: ExportFormat }> = [
  {
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <FileJson size={14} />
        JSON
      </span>
    ),
    value: 'json',
  },
  {
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <FileText size={14} />
        Markdown
      </span>
    ),
    value: 'markdown',
  },
];
function DataExportPageComp(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scopes, setScopes] = useState<ExportScope[]>(SCOPE_OPTIONS.map((o) => o.value));
  const [exporting, setExporting] = useState(false);

  const handleExport = async (): Promise<void> => {
    if (!id) {
      toast.error({ title: '未找到项目 ID' });
      return;
    }
    if (scopes.length === 0) {
      toast.error({ title: '请至少选择一个导出模块' });
      return;
    }
    setExporting(true);
    try {
      const data: ExportData = {};
      // Project title is needed to filter paper-related emails even when
      // "项目信息" is not selected for export.
      let projectTitle = '';
      if (scopes.includes('project') || scopes.includes('emails')) {
        try {
          const project = (await window.api.db.projects.get(id)) ?? undefined;
          projectTitle = project?.title ?? '';
          if (scopes.includes('project')) {
            data.project = project;
          }
        } catch (e) {
          throw new Error('加载项目信息失败: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (scopes.includes('progressNodes')) {
        try {
          data.progressNodes = await window.api.db.progressNodes.list(id);
        } catch (e) {
          throw new Error('加载进度节点失败: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (scopes.includes('codeVersions')) {
        try {
          data.codeVersions = await window.api.db.codeVersions.list(id);
        } catch (e) {
          throw new Error('加载代码版本失败: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (scopes.includes('experiments')) {
        try {
          data.experiments = await window.api.db.experiments.list(id);
        } catch (e) {
          throw new Error('加载实验失败: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (scopes.includes('latexVersions')) {
        try {
          data.latexVersions = await window.api.db.latexVersions.list(id);
        } catch (e) {
          throw new Error('加载 LaTeX 版本失败: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (scopes.includes('emails')) {
        try {
          const emails = await window.api.db.emails.list(id);
          // Same paper-title filter as the submission manager UI
          data.emails = emails.filter((e) => matchesPaperTitle(e, projectTitle));
        } catch (e) {
          throw new Error('加载邮件失败: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      const content =
        format === 'json' ? exportToJSON(data) : exportToMarkdown(data);
      const ext = format === 'json' ? 'json' : 'md';
      const defaultName = `project-${id}.${ext}`;
      const filters =
        format === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'Markdown', extensions: ['md'] }];

      let filePath: string | null = null;
      try {
        filePath = await window.api.dialog.saveFile(defaultName, filters);
      } catch (e) {
        throw new Error('选择保存路径失败: ' + (e instanceof Error ? e.message : String(e)));
      }
      if (!filePath) {
        return;
      }

      try {
        // Write to the user-chosen path via the main-process IPC channel.
        // The renderer cannot touch the filesystem directly.
        await window.api.dialog.writeFile(filePath, content);
      } catch (e) {
        throw new Error('写入文件失败: ' + (e instanceof Error ? e.message : String(e)));
      }

      toast.success({ title: '导出成功', description: filePath });
    } catch (e) {
      toast.error({
        title: '导出失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExporting(false);
    }
  };
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Download size={18} style={{ color: theme.colorText }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: theme.colorText }}>
              数据导出
            </span>
          </span>
        }
        style={{
          borderRadius: theme.borderRadiusLG,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: theme.colorText }}>
              导出格式
            </span>
            <Segmented
              options={FORMAT_OPTIONS}
              value={format}
              onChange={(value) => setFormat(value as ExportFormat)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: theme.colorText }}>
              导出范围
            </span>
            <Checkbox.Group
              options={SCOPE_OPTIONS}
              value={scopes}
              onChange={(checkedValues) => setScopes(checkedValues as ExportScope[])}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<Download size={16} />}
              loading={exporting}
              onClick={() => {
                void handleExport();
              }}
            >
              导出
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export const DataExportPage = memo(DataExportPageComp);