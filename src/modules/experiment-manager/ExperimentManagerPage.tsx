import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, Empty, SearchBar, Segmented, toast } from '@lobehub/ui';
import { Plus, Search, Table as TableIcon, LayoutGrid, FlaskConical } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useTheme } from 'antd-style';
import { pageVariants } from '@renderer/lib/motion';
import { useExperimentStore } from './store';
import type { ExperimentViewMode } from './store';
import { ExperimentTable } from './ExperimentTable';
import { ExperimentCard } from './ExperimentCard';
import { ExperimentDetail } from './ExperimentDetail';
import { AddExperimentModal } from './AddExperimentModal';
import type { Experiment } from '@shared/types';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_CARDS = 6;

const VIEW_OPTIONS: Array<{ label: React.ReactNode; value: ExperimentViewMode }> = [
  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><TableIcon size={14} />表格</span>, value: 'table' },
  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LayoutGrid size={14} />卡片</span>, value: 'card' },
];

function matchesSearch(experiment: Experiment, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    experiment.name,
    experiment.dataset ?? '',
    experiment.model ?? '',
    experiment.notes ?? '',
    experiment.experiment_type,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function ExperimentManagerPageComp(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();

  const experiments = useExperimentStore((s) => s.experiments);
  const loading = useExperimentStore((s) => s.loading);
  const error = useExperimentStore((s) => s.error);
  const viewMode = useExperimentStore((s) => s.viewMode);
  const selectedId = useExperimentStore((s) => s.selectedId);
  const loadExperiments = useExperimentStore((s) => s.loadExperiments);
  const selectExperiment = useExperimentStore((s) => s.selectExperiment);
  const setViewMode = useExperimentStore((s) => s.setViewMode);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadExperiments(id);
  }, [id, loadExperiments]);

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

  const filteredExperiments = useMemo(
    () => experiments.filter((e) => matchesSearch(e, debouncedQuery)),
    [experiments, debouncedQuery],
  );

  const selectedExperiment = useMemo(
    () => experiments.find((e) => e.id === selectedId) ?? null,
    [experiments, selectedId],
  );

  const handleSearchChange = (value: string): void => {
    setInputValue(value);
  };

  const handleSearch = (value: string): void => {
    setDebouncedQuery(value);
  };

  const handleRetry = (): void => {
    if (!id) return;
    void loadExperiments(id);
  };

  const handleOpenDetail = (experimentId: string): void => {
    selectExperiment(experimentId);
  };

  const handleCloseDetail = (): void => {
    selectExperiment(null);
  };

  const handleAddClick = (): void => {
    if (!id) {
      toast.error({ title: '无法创建实验', description: '未找到项目 ID' });
      return;
    }
    setAddModalOpen(true);
  };

  const renderContent = (): React.ReactNode => {
    if (loading) return null;

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
    if (debouncedQuery && filteredExperiments.length === 0) {
      return (
        <Empty
          icon={Search}
          title="未找到匹配实验"
          description={`没有找到包含 "${debouncedQuery}" 的实验`}
          type="page"
        />
      );
    }

    // No experiments at all
    if (experiments.length === 0) {
      return (
        <Empty
          icon={FlaskConical}
          title="暂无实验"
          description="点击上方「新建实验」按钮开始记录实验数据"
          type="page"
        />
      );
    }

    if (viewMode === 'table') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{ contain: 'layout paint' }}
        >
          <ExperimentTable experiments={filteredExperiments} onRowClick={handleOpenDetail} />
        </motion.div>
      );
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        <AnimatePresence initial={false}>
          {filteredExperiments.map((experiment, index) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              index={index}
              onClick={handleOpenDetail}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 12px',
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 8,
          background: theme.colorBgContainer,
        }}
      >
        <Button type="primary" icon={<Plus size={16} />} onClick={handleAddClick}>
          新建实验
        </Button>
        <Segmented
          options={VIEW_OPTIONS}
          value={viewMode}
          onChange={(value) => setViewMode(value as ExperimentViewMode)}
        />
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <SearchBar
            placeholder="搜索实验名称、数据集、模型..."
            value={inputValue}
            onInputChange={handleSearchChange}
            onSearch={handleSearch}
            spotlight
          />
        </div>
      </div>

      {/* Content */}
      {renderContent()}

      {/* Detail modal */}
      <ExperimentDetail
        experiment={selectedExperiment}
        open={selectedExperiment !== null}
        onClose={handleCloseDetail}
      />

      {/* Add experiment modal */}
      {id && (
        <AddExperimentModal
          projectId={id}
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </motion.div>
  );
}

export const ExperimentManagerPage = memo(ExperimentManagerPageComp);
