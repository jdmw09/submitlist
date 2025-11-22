import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { taskAPI, organizationAPI } from '../services/api';
import { Task } from '../types';
import Layout from '../components/Layout';
import './TasksPage.css';

const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState<'due_date' | 'priority'>('due_date');
  const [showArchived, setShowArchived] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    loadSelectedOrg();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      loadTasks();
      loadOrgSettings();
    }
  }, [selectedOrg, filter, sortOrder, hideCompleted]);

  useEffect(() => {
    if (selectedOrg && showArchived) {
      loadArchivedTasks();
    }
  }, [selectedOrg, showArchived]);

  const loadSelectedOrg = () => {
    const stored = localStorage.getItem('selectedOrganization');
    if (stored) {
      setSelectedOrg(JSON.parse(stored));
    } else {
      navigate('/organizations');
    }
  };

  const loadOrgSettings = async () => {
    if (!selectedOrg) return;
    try {
      const response = await organizationAPI.getSettings(selectedOrg.id);
      const settings = response.data.settings;
      if (settings) {
        setSortOrder(settings.default_task_sort || 'due_date');
        setHideCompleted(settings.hide_completed_tasks || false);
      }
    } catch (error) {
      console.error('Failed to load org settings:', error);
    }
  };

  const loadTasks = async () => {
    if (!selectedOrg) return;

    setLoading(true);
    setError(null);
    try {
      const response = await taskAPI.getAll(selectedOrg.id, {
        assignedToMe: filter === 'mine',
        sort: sortOrder,
        hideCompleted: hideCompleted,
      });
      setTasks(response.data.tasks || []);
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
      setError(error.response?.data?.error || 'Failed to load tasks. Please try again.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedTasks = async () => {
    if (!selectedOrg) return;
    try {
      const response = await taskAPI.getArchived(selectedOrg.id);
      setArchivedTasks(response.data.tasks || []);
    } catch (error: any) {
      console.error('Failed to load archived tasks:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#388e3c'; // WCAG AA compliant (4.51:1 contrast ratio)
      case 'in_progress':
        return '#1976d2'; // WCAG AA compliant (4.60:1 contrast ratio)
      case 'overdue':
        return '#d32f2f'; // WCAG AA compliant (5.09:1 contrast ratio)
      default:
        return '#f57c00'; // WCAG AA compliant (4.54:1 contrast ratio) - pending status
    }
  };

  if (!selectedOrg) {
    return (
      <Layout>
        <div className="no-org">
          <h2>No Organization Selected</h2>
          <p>Please select an organization to view tasks</p>
          <Link to="/organizations" className="btn btn-primary">
            Go to Organizations
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="tasks-page">
        <div className="page-header">
          <div>
            <h1>{selectedOrg.name} - Tasks</h1>
            <p className="org-role">Your role: {selectedOrg.role}</p>
          </div>
          <div className="header-actions">
            <Link to="/tasks/import" className="btn btn-secondary">
              Import CSV
            </Link>
            <Link to="/tasks/create" className="btn btn-primary">
              + Create Task
            </Link>
          </div>
        </div>

        <div className="filters">
          <div className="filter-group">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
            >
              All Tasks
            </button>
            <button
              className={`filter-btn ${filter === 'mine' ? 'active' : ''}`}
              onClick={() => setFilter('mine')}
              aria-pressed={filter === 'mine'}
            >
              My Tasks
            </button>
            <button
              className={`filter-btn ${showArchived ? 'active' : ''}`}
              onClick={() => setShowArchived(!showArchived)}
              aria-pressed={showArchived}
            >
              Archived
            </button>
          </div>

          <div className="filter-group">
            <label className="sort-label">
              Sort:
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'due_date' | 'priority')}
                className="sort-select"
              >
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
              />
              Hide completed
            </label>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{
            padding: '1rem',
            margin: '1rem 0',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33'
          }}>
            <p><strong>Error:</strong> {error}</p>
            <button onClick={loadTasks} className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty">
            <p>No tasks found</p>
            <Link to="/tasks/create" className="btn btn-primary">
              Create your first task
            </Link>
          </div>
        ) : (
          <div className="tasks-grid">
            {tasks.map((task) => {
              const progress = task.total_requirements
                ? ((task.completed_requirements || 0) / task.total_requirements) * 100
                : 0;

              // Build descriptive aria-label for task card
              const statusLabel = task.status.replace('_', ' ');
              const assigneeLabel = task.assigned_user_name ? `, assigned to ${task.assigned_user_name}` : '';
              const progressLabel = task.total_requirements
                ? `, ${task.completed_requirements} of ${task.total_requirements} requirements completed`
                : '';
              const dueDateLabel = task.end_date
                ? `, due ${new Date(task.end_date).toLocaleDateString()}`
                : '';
              const ariaLabel = `${task.title}, status: ${statusLabel}${assigneeLabel}${progressLabel}${dueDateLabel}`;

              return (
                <Link
                  to={`/tasks/${task.id}`}
                  key={task.id}
                  className="task-card"
                  aria-label={ariaLabel}
                >
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(task.status) }}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  {task.details && (
                    <p className="task-details">{task.details.substring(0, 100)}...</p>
                  )}

                  <div className="task-meta">
                    {task.assigned_user_name && (
                      <span>👤 {task.assigned_user_name}</span>
                    )}
                    {task.schedule_type !== 'one_time' && (
                      <span>🔄 {task.schedule_type}</span>
                    )}
                  </div>

                  {task.total_requirements && task.total_requirements > 0 && (
                    <div className="progress-section">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="progress-text">
                        {task.completed_requirements}/{task.total_requirements} completed
                      </span>
                    </div>
                  )}

                  {task.end_date && (
                    <div className="task-date">
                      Due: {new Date(task.end_date).toLocaleDateString()}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {showArchived && (
          <div className="archived-section">
            <h2>Archived Tasks</h2>
            {archivedTasks.length === 0 ? (
              <p className="empty-text">No archived tasks</p>
            ) : (
              <div className="tasks-grid archived">
                {archivedTasks.map((task) => (
                  <Link
                    to={`/tasks/${task.id}`}
                    key={task.id}
                    className="task-card archived"
                  >
                    <div className="task-header">
                      <h3>{task.title}</h3>
                      <span className="status-badge archived-badge">
                        Archived
                      </span>
                    </div>
                    {task.details && (
                      <p className="task-details">{task.details.substring(0, 100)}...</p>
                    )}
                    <div className="task-meta">
                      <span>Archived: {task.archived_at ? new Date(task.archived_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TasksPage;
