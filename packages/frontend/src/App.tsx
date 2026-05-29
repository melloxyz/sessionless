import { Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { SessionsPage } from './pages/SessionsPage.js';
import { SessionDetailPage } from './pages/SessionDetailPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { ProjectDetailPage } from './pages/ProjectDetailPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { ModelsPage } from './pages/ModelsPage.js';
import { ThemeProvider } from './components/theme/ThemeProvider.js';
import { LanguageProvider } from './components/i18n/LanguageProvider.js';
import { DateRangeProvider } from './components/filters/DateRangeProvider.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { BudgetsPage } from './pages/BudgetsPage.js';
import { ChangelogPage } from './pages/ChangelogPage.js';

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <DateRangeProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
            </Route>
          </Routes>
        </DateRangeProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
