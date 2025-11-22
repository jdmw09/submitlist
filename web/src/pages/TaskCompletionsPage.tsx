import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskAPI } from '../services/api';
import { Task, TaskCompletion } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import './TaskCompletionsPage.css';

const TaskCompletionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupByRequirement, setGroupByRequirement] = useState(true);

  useEffect(() => {
    if (id) {
      loadTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadTask = async () => {
    try {
      const response = await taskAPI.getById(Number(id));
      setTask(response.data.task);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load task');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompletion = async (completionId: number) => {
    if (!window.confirm('Are you sure you want to delete this completion?')) {
      return;
    }

    try {
      await taskAPI.deleteCompletion(completionId);
      alert('Completion deleted successfully');
      loadTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete completion');
    }
  };

  const renderFileContent = (completion: TaskCompletion) => {
    if (!completion.file_path) return null;

    let filePaths: string[] = [];
    try {
      filePaths = JSON.parse(completion.file_path);
    } catch {
      filePaths = [completion.file_path];
    }

    return (
      <div className="completion-files-grid">
        {completion.completion_type === 'image' && filePaths.map((path, idx) => (
          <div key={idx} className="file-item">
            <img
              src={path}
              alt={`Completion ${idx + 1}`}
              className="completion-image-large"
            />
            <a href={path} download className="download-link">
              ⬇ Download
            </a>
          </div>
        ))}
        {completion.completion_type === 'video' && filePaths.map((path, idx) => (
          <div key={idx} className="file-item">
            <video
              src={path}
              className="completion-video-large"
              controls
            />
            <a href={path} download className="download-link">
              ⬇ Download
            </a>
          </div>
        ))}
        {completion.completion_type === 'document' && filePaths.map((path, idx) => (
          <div key={idx} className="file-item">
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              className="completion-document-card"
            >
              <div className="document-icon">📄</div>
              <div className="document-name">{path.split('/').pop()}</div>
            </a>
            <a href={path} download className="download-link">
              ⬇ Download
            </a>
          </div>
        ))}
      </div>
    );
  };

  const renderCompletionCard = (completion: TaskCompletion) => {
    const canDelete = user && (task?.created_by_id === user.id || completion.user_id === user.id);

    return (
      <div key={completion.id} className="completion-card">
        <div className="completion-card-header">
          <div className="completion-user-info">
            <div className="user-avatar">
              {(completion.user_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="user-name">{completion.user_name || 'Unknown'}</div>
              <div className="completion-date">
                {new Date(completion.completed_at).toLocaleString()}
              </div>
            </div>
          </div>
          {canDelete && (
            <button
              className="btn btn-sm btn-danger"
              onClick={() => handleDeleteCompletion(completion.id)}
            >
              Delete
            </button>
          )}
        </div>

        {completion.text_content && (
          <div className="completion-text">
            {completion.text_content}
          </div>
        )}

        {renderFileContent(completion)}
      </div>
    );
  };

  const renderCompletionsByRequirement = () => {
    const requirementGroups = new Map<number | string, TaskCompletion[]>();

    task?.completions?.forEach(completion => {
      const key = completion.requirement_id || 'general';
      if (!requirementGroups.has(key)) {
        requirementGroups.set(key, []);
      }
      requirementGroups.get(key)!.push(completion);
    });

    return Array.from(requirementGroups.entries()).map(([reqId, completions]) => {
      const requirement = task?.requirements?.find(r => r.id === reqId);
      const title = requirement?.description || 'General Completions';

      return (
        <div key={reqId} className="requirement-group">
          <h3 className="requirement-title">{title}</h3>
          <div className="completions-grid">
            {completions.map(renderCompletionCard)}
          </div>
        </div>
      );
    });
  };

  const renderCompletionsChronological = () => {
    const sortedCompletions = [...(task?.completions || [])].sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );

    return (
      <div className="completions-grid">
        {sortedCompletions.map(renderCompletionCard)}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading completions...</div>
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout>
        <div className="error">Task not found</div>
      </Layout>
    );
  }

  const completionsCount = task.completions?.length || 0;

  return (
    <Layout>
      <div className="task-completions-page">
        <button className="btn btn-secondary" onClick={() => navigate(`/tasks/${id}`)}>
          ← Back to Task
        </button>

        <div className="completions-header">
          <div>
            <h1>Task Completions</h1>
            <p className="task-title">{task.title}</p>
            <p className="completions-count">
              {completionsCount} {completionsCount === 1 ? 'completion' : 'completions'}
            </p>
          </div>

          <div className="view-toggle">
            <button
              className={`btn btn-sm ${groupByRequirement ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroupByRequirement(true)}
            >
              Group by Requirement
            </button>
            <button
              className={`btn btn-sm ${!groupByRequirement ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroupByRequirement(false)}
            >
              Chronological
            </button>
          </div>
        </div>

        {completionsCount === 0 ? (
          <div className="card">
            <p className="no-completions">No completions yet for this task.</p>
          </div>
        ) : (
          <div className="completions-container">
            {groupByRequirement ? renderCompletionsByRequirement() : renderCompletionsChronological()}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TaskCompletionsPage;
