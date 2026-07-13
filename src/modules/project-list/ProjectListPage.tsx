import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { Button, Empty, SearchBar } from '@lobehub/ui';
import { Plus, Search, ArrowDownUp } from 'lucide-react';
import { Select } from 'antd';
import { useTheme } from 'antd-style';
import { Hero } from './Hero';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './CreateProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { useProjectStore } from '@renderer/stores/projectStore';
import { useUIStore } from '@renderer/stores/uiStore';
import type { Project } from '@shared/types';

const SEARCH_DEBOUNCE_MS = 300;

type SortKey = 'updated' | 'created' | 'title';

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: '最近更新', value: 'updated' },
  { label: '最近创建', value: 'created' },
  { label: '标题排序', value: 'title' },
];

function sortProjects(projects: Project[], sortKey: SortKey): Project[] {
  const arr = [...projects];
  switch (sortKey) {
    case 'updated':
      return arr.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    case 'created':
      return arr.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case 'title':
      return arr.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans'));
    default:
      return arr;
  }
}

function matchesSearch(project: Project, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    project.title,
    project.description ?? '',
    project.target_venue ?? '',
    ...(project.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function ProjectListPageComp(): React.ReactElement {
  const theme = useTheme();
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const createModalOpen = useUIStore((s) => s.createModalOpen);
  const setCreateModalOpen = useUIStore((s) => s.setCreateModalOpen);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('updated');

  // Input value updates immediately; debouncedQuery follows after 300ms
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  const filteredProjects = useMemo(
    () => projects.filter((p) => matchesSearch(p, debouncedQuery)),
    [projects, debouncedQuery],
  );

  const sortedProjects = useMemo(
    () => sortProjects(filteredProjects, sortKey),
    [filteredProjects, sortKey],
  );

  const handleSearchChange = (value: string): void => {
    setInputValue(value);
  };

  const handleSearch = (value: string): void => {
    setDebouncedQuery(value);
  };

  const handleRetry = (): void => {
    fetchProjects();
  };

  const handleEditProject = useCallback((project: Project): void => {
    setEditingProject(project);
  }, []);

  const renderContent = (): React.ReactNode => {
    if (loading) {
      return null;
    }

    if (error) {
      return (
        <Empty
          title="加载失败"
          description={error}
          type="page"
          action={<Button onClick={handleRetry}>重试</Button>}
        />
      );
    }

    // Search yielded no matches
    if (debouncedQuery && sortedProjects.length === 0) {
      return (
        <Empty
          icon={Search}
          title="未找到匹配项目"
          description={`没有找到包含 "${debouncedQuery}" 的项目`}
          type="page"
        />
      );
    }

    // No projects at all
    if (projects.length === 0) {
      return (
        <Empty
          title="暂无项目"
          description="点击上方新建项目按钮开始"
          type="page"
        />
      );
    }

    // Project list — single column with AnimatePresence for filter reflow
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence>
          {sortedProjects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} onEdit={handleEditProject} />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: theme.colorBgLayout,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px 48px 24px',
        }}
      >
        <Hero />

        {/* Actions bar — centered */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 20,
            marginBottom: 52,
          }}
        >
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            新建项目
          </Button>
          <div style={{ width: 280 }}>
            <SearchBar
              placeholder="搜索关键词..."
              value={inputValue}
              onInputChange={handleSearchChange}
              onSearch={handleSearch}
              spotlight
            />
          </div>
        </div>

        {/* Divider between actions and project list */}
        <div
          style={{
            height: 1,
            background: theme.colorBorderSecondary,
            marginBottom: 16,
          }}
        />

        {/* Sort row — right aligned */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            marginBottom: 16,
            color: theme.colorTextTertiary,
            fontSize: 13,
          }}
        >
          <ArrowDownUp size={13} />
          <span>排序：</span>
          <Select
            size="small"
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={SORT_OPTIONS}
            virtual={false}
            style={{ width: 120 }}
          />
        </div>

        {renderContent()}
      </div>

      {/* Create project modal — owned by Subagent B */}
      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Edit project modal */}
      <EditProjectModal
        open={editingProject !== null}
        onClose={() => setEditingProject(null)}
        project={editingProject}
      />
    </div>
  );
}

export const ProjectListPage = ProjectListPageComp;
