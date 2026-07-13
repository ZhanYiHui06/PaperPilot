import { memo, useState, useCallback } from 'react';
import { Modal, Input, Button, toast } from '@lobehub/ui';
import { Radio, Checkbox } from 'antd';
import { GitBranch, Upload, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from 'antd-style';
import { useCodeManagerStore } from './store';
import { FileDropZone } from '@renderer/components/shared/FileDropZone';
import type { CodeVersion, GitCommit } from '@shared/types';

interface AddVersionModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

type Mode = 'git' | 'manual';

interface UploadedFile {
  name: string;
  content: string;
}

// Generate a unified-style diff between two text contents (line-based LCS).
// Used to compare the current upload with the previous version's file content.
function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS length table
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff entries
  const entries: { type: '+' | '-' | ' '; line: string }[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      entries.unshift({ type: ' ', line: oldLines[i - 1] });
      i--;
      j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      entries.unshift({ type: '-', line: oldLines[i - 1] });
      i--;
    } else {
      entries.unshift({ type: '+', line: newLines[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    entries.unshift({ type: '-', line: oldLines[i - 1] });
    i--;
  }
  while (j > 0) {
    entries.unshift({ type: '+', line: newLines[j - 1] });
    j--;
  }

  // Only output changed lines (skip unchanged context to keep diff concise)
  const result: string[] = [];
  for (const e of entries) {
    if (e.type !== ' ') {
      result.push(`${e.type} ${e.line}`);
    }
  }
  return result.join('\n');
}

function AddVersionModalComp({
  projectId,
  open,
  onClose,
}: AddVersionModalProps): React.ReactElement {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('git');
  const [submitting, setSubmitting] = useState(false);

  // Git mode state
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());

  // Manual mode state
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [versionLabel, setVersionLabel] = useState('');

  const addVersion = useCodeManagerStore((s) => s.addVersion);
  const gitRepoPath = useCodeManagerStore((s) => s.gitRepoPath);
  const gitCommits = useCodeManagerStore((s) => s.gitCommits);
  const versions = useCodeManagerStore((s) => s.versions);

  // Whether this is the first version for the project (no prior versions exist).
  // First version stores file content without AI diff summary; subsequent
  // versions compare against the latest version's file_content.
  const isFirstVersion = versions.length === 0;

  const handleClose = (): void => {
    setSelectedHashes(new Set());
    setUploadedFile(null);
    setVersionLabel('');
    setMode('git');
    onClose();
  };

  // --- Git mode handlers ---
  const toggleCommit = useCallback((hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const selectAllCommits = () => {
    setSelectedHashes(new Set(gitCommits.map((c) => c.hash)));
  };

  const deselectAllCommits = () => {
    setSelectedHashes(new Set());
  };

  // --- Manual mode handlers ---
  const handleFileUpload = useCallback((content: string, fileName: string) => {
    setUploadedFile({ name: fileName, content });
  }, []);

  const removeFile = () => {
    setUploadedFile(null);
  };

  // --- Submit handlers ---
  const handleGitSubmit = async (): Promise<void> => {
    if (!gitRepoPath) {
      toast.warning({ title: '未配置 Git 仓库', description: '请先在设置中配置 Git 仓库路径' });
      return;
    }
    if (selectedHashes.size === 0) {
      toast.warning({ title: '请选择要记录的提交' });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process selected commits in order (newest first as gitCommits is sorted)
      const commitsToRecord = gitCommits.filter((c) => selectedHashes.has(c.hash));
      for (const commit of commitsToRecord) {
        try {
          const partial: Partial<CodeVersion> = {
            project_id: projectId,
            version_label: commit.message.split('\n')[0].slice(0, 120) || commit.hash.slice(0, 8),
            git_commit_hash: commit.hash,
          };

          // Get diff for this commit
          try {
            const diff = await window.api.git.getDiff(gitRepoPath, `${commit.hash}~1`, commit.hash);
            if (diff.trim()) {
              partial.diff_text = diff;
              try {
                partial.ai_summary = await window.api.llm.summarize('code', diff);
              } catch {
                // Non-fatal: keep diff_text even if summary fails
              }
            }
          } catch {
            // Diff might fail for initial commit — record without diff
          }

          await addVersion(partial);
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success({
          title: `已记录 ${successCount} 个版本`,
          description: failCount > 0 ? `${failCount} 个提交记录失败` : undefined,
        });
      } else {
        toast.error({ title: '记录失败', description: '所有提交均记录失败' });
      }
      handleClose();
    } catch (e: unknown) {
      toast.error({
        title: '记录失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (): Promise<void> => {
    if (!uploadedFile) {
      toast.warning({ title: '请上传代码文件' });
      return;
    }
    if (!versionLabel.trim()) {
      toast.warning({ title: '请输入版本名称' });
      return;
    }

    setSubmitting(true);
    try {
      const partial: Partial<CodeVersion> = {
        project_id: projectId,
        version_label: versionLabel.trim(),
        file_content: uploadedFile.content,
      };

      if (isFirstVersion) {
        // First version: no diff to compare against, skip AI summary.
        // Just persist the file content for future comparisons.
      } else {
        // Subsequent version: diff against the latest version's file content.
        // versions[] is sorted newest-first, so versions[0] is the previous version.
        const prevContent = versions[0]?.file_content ?? null;
        if (prevContent) {
          const diff = generateDiff(prevContent, uploadedFile.content);
          partial.diff_text = diff;
          if (diff.trim()) {
            try {
              partial.ai_summary = await window.api.llm.summarize('code', diff);
            } catch {
              // Non-fatal: keep diff_text even if summary fails
            }
          }
        }
      }

      await addVersion(partial);
      toast.success({ title: '版本已记录' });
      handleClose();
    } catch (e: unknown) {
      toast.error({
        title: '记录失败',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (): void => {
    if (mode === 'git') {
      void handleGitSubmit();
    } else {
      void handleManualSubmit();
    }
  };

  const canSubmit =
    mode === 'git' ? selectedHashes.size > 0 : !!uploadedFile && versionLabel.trim().length > 0;

  return (
    <Modal
      open={open}
      title="记录代码版本"
      width={580}
      centered
      onCancel={handleClose}
      destroyOnHidden
      className="code-version-modal"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {mode === 'git' ? `记录 ${selectedHashes.size} 个提交` : '记录版本'}
          </Button>
        </div>
      }
    >
      {/* Mode selector */}
      <div style={{ marginBottom: 16 }}>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <Radio value="git" disabled={!gitRepoPath}>
            <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={14} />
              Git 自动记录
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.65 }}>
              从 Git 历史中选择提交，自动记录为版本
            </span>
          </Radio>
          <Radio value="manual">
            <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} />
              手动上传代码
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.65 }}>
              上传代码文件，系统自动与上一版本对比并生成摘要
            </span>
          </Radio>
        </Radio.Group>
      </div>

      {/* Git mode: commit list */}
      {mode === 'git' && (
        <div>
          {!gitRepoPath ? (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: theme.colorFillQuaternary,
                textAlign: 'center',
                color: theme.colorTextTertiary,
                fontSize: 13,
              }}
            >
              Git 仓库未配置，请先在设置中配置 Git 仓库路径
            </div>
          ) : gitCommits.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: theme.colorFillQuaternary,
                textAlign: 'center',
                color: theme.colorTextTertiary,
                fontSize: 13,
              }}
            >
              Git 仓库无提交记录
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: theme.colorTextSecondary }}>
                  最近 {gitCommits.length} 条提交
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="small" type="text" onClick={selectAllCommits}>
                    全选
                  </Button>
                  <Button size="small" type="text" onClick={deselectAllCommits}>
                    取消全选
                  </Button>
                </div>
              </div>
              <div
                style={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  border: `1px solid ${theme.colorBorderSecondary}`,
                  borderRadius: 8,
                }}
              >
                {gitCommits.map((commit: GitCommit) => {
                  const isSelected = selectedHashes.has(commit.hash);
                  return (
                    <div
                      key={commit.hash}
                      onClick={() => toggleCommit(commit.hash)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: `1px solid ${theme.colorBorderSecondary}`,
                        background: isSelected ? theme.colorPrimaryBg : 'transparent',
                        transition: 'background 0.14s ease',
                      }}
                    >
                      <Checkbox checked={isSelected} style={{ marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: theme.colorText,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {commit.message.split('\n')[0]}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 2,
                            fontSize: 12,
                            color: theme.colorTextTertiary,
                          }}
                        >
                          <code style={{ fontFamily: 'ui-monospace, monospace' }}>
                            {commit.hash.slice(0, 8)}
                          </code>
                          <span>{commit.author}</span>
                          <span>{format(new Date(commit.date), 'MM-dd HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual mode: single file upload */}
      {mode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: theme.colorText,
                marginBottom: 6,
              }}
            >
              版本名称
            </label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="如：基线模型训练 v1"
              maxLength={120}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: theme.colorText,
                marginBottom: 6,
              }}
            >
              上传代码文件
            </label>
            {!uploadedFile ? (
              <FileDropZone
                accept=".py,.js,.ts,.java,.cpp,.c,.h,.rs,.go,.rb,.txt,.md"
                description="拖拽代码文件到此处，或点击选择"
                hint="上传当前版本的代码文件，系统将与上一版本对比"
                onFileContent={handleFileUpload}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${theme.colorBorderSecondary}`,
                  background: theme.colorFillQuaternary,
                }}
              >
                <FileText size={16} style={{ color: theme.colorTextTertiary, flexShrink: 0 }} />
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
                  {uploadedFile.name}
                </span>
                <Button
                  icon={<X size={14} />}
                  type="text"
                  size="small"
                  onClick={removeFile}
                />
              </div>
            )}
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: theme.colorInfoBg,
              border: `1px solid ${theme.colorInfoBorder}`,
              fontSize: 12,
              color: theme.colorInfoText,
            }}
          >
            {isFirstVersion
              ? '首个版本仅保存代码内容，不生成 AI 摘要。从第二个版本起将自动与上一版本对比并生成变更摘要。'
              : '系统将自动与上一版本的代码内容对比，生成 diff 并由 AI 总结变更。'}
          </div>
        </div>
      )}
    </Modal>
  );
}

export const AddVersionModal = memo(AddVersionModalComp);
