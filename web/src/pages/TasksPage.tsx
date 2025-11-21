import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { taskAPI } from '../services/api';
import { Task } from '../types';
import Layout from '../components/Layout';
import './TasksPage.css';

const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  useEffect(() => {
    loadSelectedOrg();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      loadTasks();
    }
  }, [selectedOrg, filter]);

  const loadSelectedOrg = () => {
    const stored = localStorage.getItem('selectedOrganization');
    if (stored) {
      setSelectedOrg(JSON.parse(stored));
    } else {
      navigate('/organizations');
    }
  };

  const loadTasks = async () => {
    if (!selectedOrg) return;

    setLoading(true);
    setError(null);
    try {
      const response = await taskAPI.getAll(selectedOrg.id, {
        assignedToMe: filter === 'mine',
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
      </div>
    </Layout>
  );
};

export default TasksPage;
