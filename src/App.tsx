import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { NotFound } from './pages/NotFound';
import { ProjectListPage } from './modules/project-list/ProjectListPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { OverviewDashboard } from './modules/dashboard/OverviewDashboard';
import { SettingsPage } from './modules/settings/SettingsPage';
import { AboutPage } from './modules/about';
import { ArchivePage } from './modules/archive';
import { CodeManagerPage } from './modules/code-manager';
import { ExperimentManagerPage } from './modules/experiment-manager';
import { LatexEditorPage } from './modules/latex-editor';
import { SubmissionManagerPage } from './modules/submission-manager';
import { DataExportPage } from './modules/data-export';

function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/project/:id" element={<DashboardPage />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<></>} />
            <Route path="code" element={<CodeManagerPage />} />
            <Route path="experiments" element={<ExperimentManagerPage />} />
            <Route path="writing" element={<LatexEditorPage />} />
            <Route path="submission" element={<SubmissionManagerPage />} />
            <Route path="export" element={<DataExportPage />} />
          </Route>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
