import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskAPI } from '../services/api';
import { Task, TaskRequirement } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import './TaskDetailPage.css';

const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedReq, setExpandedReq] = useState<number | null>(null);
  const [completionTexts, setCompletionTexts] = useState<{ [key: number]: string }>({});
  const [selectedFiles, setSelectedFiles] = useState<{ [key: number]: File[] }>({});
  const [reviewComments, setReviewComments] = useState('');
  const [userOrgRole, setUserOrgRole] = useState<'admin' | 'member' | null>(null);

  useEffect(() => {
    if (id) {
      loadTask();
    }
  }, [id]);

  const loadTask = async () => {
    try {
      const response = await taskAPI.getById(Number(id));
      setTask(response.data.task);

      // Check user's role in this task's organization
      if (response.data.task.organization_id && user) {
        try {
          const orgCheckResponse = await fetch(`${process.env.REACT_APP_API_URL}/organizations/${response.data.task.organization_id}/members`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (orgCheckResponse.ok) {
            const orgData = await orgCheckResponse.json();
            const member = orgData.members?.find((m: any) => m.user_id === user.id);
            if (member) {
              setUserOrgRole(member.role);
            }
          }
        } catch (err) {
          console.error('Error checking org role:', err);
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load task');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const toggleRequirement = async (reqId: number, completed: boolean) => {
    try {
      await taskAPI.updateRequirement(reqId, !completed);
      loadTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update requirement');
    }
  };

  const handleFileChange = (reqId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles({ ...selectedFiles, [reqId]: Array.from(e.target.files) });
    }
  };

  const uploadFile = async (reqId: number) => {
    const files = selectedFiles[reqId];
    if (!files || files.length === 0) {
      alert('Please select at least one file');
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('requirementId', reqId.toString());

    try {
      await taskAPI.addCompletion(Number(id), formData);
      setSelectedFiles({ ...selectedFiles, [reqId]: [] });
      setExpandedReq(null);
      alert(`${files.length} file(s) uploaded successfully`);
      loadTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to upload files');
    }
  };

  const addTextCompletion = async (reqId: number) => {
    const text = completionTexts[reqId];
    if (!text || !text.trim()) {
      alert('Please enter completion text');
      return;
    }

    const formData = new FormData();
    formData.append('textContent', text);
    formData.append('completionType', 'text');
    formData.append('requirementId', reqId.toString());

    try {
      await taskAPI.addCompletion(Number(id), formData);
      setCompletionTexts({ ...completionTexts, [reqId]: '' });
      setExpandedReq(null);
      alert('Completion added successfully');
      loadTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add completion');
    }
  };

  const getRequirementCompletions = (reqId: number) => {
    return task?.completions?.filter(c => c.requirement_id === reqId) || [];
  };

  const handleSubmitTask = async () => {
    if (!window.confirm('Submit this task for review?')) {
      return;
    }

    try {
      await taskAPI.submit(Number(id));
      alert('Task submitted for review');
      loadTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to submit task');
    }
  };

  const handleReviewTask = async (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !reviewComments.trim()) {
      alert('Please provide comments for rejection');
      return;
    }

    const confirmMessage = action === 'approved'
      ? 'Approve this task?'
      : 'Reject this task and send it back for revision?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await taskAPI.review(Number(id), action, reviewComments);
      alert(`Task ${action} successfully`);
      setReviewComments('');
      loadTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to review task');
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    // Check if task has completions with files
    const hasFiles = task?.completions?.some(c => c.file_path);
    let deleteFiles = false;

    if (hasFiles) {
      deleteFiles = window.confirm(
        'This task has uploaded files. Do you want to delete the files as well?\n\n' +
        'Click OK to delete files, or Cancel to keep them on the server.'
      );
    }

    try {
      await taskAPI.delete(Number(id), deleteFiles);
      alert('Task deleted successfully');
      navigate('/');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete task');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading task...</div>
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'submitted':
        return '#9C27B0';
      case 'overdue':
        return '#f44336';
      default:
        return '#FF9800';
    }
  };

  return (
    <Layout>
      <div className="task-detail-page">
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Back to Tasks
          </button>
          {task.completions && task.completions.length > 0 && (
            <button className="btn btn-primary" onClick={() => navigate(`/tasks/${id}/completions`)}>
              View All Completions ({task.completions.length})
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(`/tasks/${id}/audit-log`)}>
            📜 View Audit Log
          </button>
        </div>

        <div className="task-header">
          <h1>{task.title}</h1>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(task.status) }}
          >
            {task.status.replace('_', ' ')}
          </span>
        </div>

        {task.details && (
          <div className="card">
            <h3>Details</h3>
            <p>{task.details}</p>
          </div>
        )}

        <div className="card">
          <h3>Information</h3>
          <div className="info-grid">
            {task.assigned_user_name && (
              <div>
                <strong>Assigned to:</strong> {task.assigned_user_name}
              </div>
            )}
            {task.created_by_name && (
              <div>
                <strong>Created by:</strong> {task.created_by_name}
              </div>
            )}
            {task.end_date && (
              <div>
                <strong>Due date:</strong> {new Date(task.end_date).toLocaleDateString()}
              </div>
            )}
            <div>
              <strong>Schedule:</strong> {task.schedule_type.replace('_', ' ')}
            </div>
          </div>
        </div>

        {task.requirements && task.requirements.length > 0 && (
          <div className="card">
            <h3>Requirements & Completions</h3>
            <div className="requirements-list">
              {task.requirements.map((req) => {
                const reqCompletions = getRequirementCompletions(req.id);
                const isExpanded = expandedReq === req.id;

                return (
                  <div key={req.id} className="requirement-card">
                    <div className="requirement-header">
                      <button
                        className="requirement-item"
                        onClick={() => toggleRequirement(req.id, req.completed)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleRequirement(req.id, req.completed);
                          }
                        }}
                        aria-label={`${req.completed ? 'Uncheck' : 'Check'} requirement: ${req.description}`}
                        type="button"
                      >
                        <input
                          type="checkbox"
                          checked={req.completed}
                          readOnly
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                        <span className={req.completed ? 'completed' : ''}>
                          {req.description}
                        </span>
                      </button>
                      {!req.completed && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                        >
                          {isExpanded ? 'Cancel' : '+ Add Completion'}
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="completion-form">
                        <div className="input-group">
                          <label htmlFor={`completion-text-${req.id}`}>Text Completion</label>
                          <textarea
                            id={`completion-text-${req.id}`}
                            value={completionTexts[req.id] || ''}
                            onChange={(e) => setCompletionTexts({ ...completionTexts, [req.id]: e.target.value })}
                            placeholder="Describe what you completed"
                            rows={3}
                          />
                        </div>
                        <button
                          className="btn btn-primary"
                          onClick={() => addTextCompletion(req.id)}
                        >
                          Add Text Completion
                        </button>

                        <div className="file-upload-section">
                          <div className="input-group">
                            <label htmlFor={`file-upload-${req.id}`}>Upload Files (multiple allowed)</label>
                            <input
                              id={`file-upload-${req.id}`}
                              type="file"
                              onChange={(e) => handleFileChange(req.id, e)}
                              accept="image/*,video/*,.heic,.heif,.tiff,.tif,.mov,.m4v,.pdf,.doc,.docx"
                              multiple
                            />
                          </div>
                          {selectedFiles[req.id] && selectedFiles[req.id].length > 0 && (
                            <div>
                              <p className="selected-files-info">
                                {selectedFiles[req.id].length} file(s) selected:
                                {selectedFiles[req.id].map((file, idx) => (
                                  <span key={idx} className="file-name"> {file.name}</span>
                                ))}
                              </p>
                              <button
                                className="btn btn-primary"
                                onClick={() => uploadFile(req.id)}
                              >
                                Upload {selectedFiles[req.id].length} file(s)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {reqCompletions.length > 0 && (
                      <div className="requirement-completions">
                        <h4>Completions:</h4>
                        {reqCompletions.map((completion) => {
                          // Parse file paths (can be JSON array or single path)
                          let filePaths: string[] = [];
                          if (completion.file_path) {
                            try {
                              filePaths = JSON.parse(completion.file_path);
                            } catch {
                              filePaths = [completion.file_path];
                            }
                          }

                          return (
                            <div key={completion.id} className="completion-item-inline">
                              <div className="completion-header">
                                <strong>{completion.user_name}</strong>
                                <span>{new Date(completion.completed_at).toLocaleString()}</span>
                              </div>
                              {completion.text_content && (
                                <p>{completion.text_content}</p>
                              )}
                              {filePaths.length > 0 && (
                                <div className="completion-files">
                                  {completion.completion_type === 'image' && filePaths.map((path, idx) => (
                                    <div key={idx} className="file-item-inline">
                                      <img
                                        src={path}
                                        alt={`Completion ${idx + 1}`}
                                        className="completion-image-small"
                                      />
                                      <a href={path} download className="download-link-small">⬇ Download</a>
                                    </div>
                                  ))}
                                  {completion.completion_type === 'video' && filePaths.map((path, idx) => (
                                    <div key={idx} className="file-item-inline">
                                      <video
                                        src={path}
                                        className="completion-video-small"
                                        controls
                                      />
                                      <a href={path} download className="download-link-small">⬇ Download</a>
                                    </div>
                                  ))}
                                  {completion.completion_type === 'document' && filePaths.map((path, idx) => (
                                    <div key={idx} className="file-item-inline">
                                      <a
                                        href={path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="completion-document-link"
                                      >
                                        📄 {path.split('/').pop()}
                                      </a>
                                      <a href={path} download className="download-link-small">⬇ Download</a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit button for assigned users */}
        {user && task.assigned_user_id === user.id && task.status === 'in_progress' && (
          <div className="card task-actions">
            <button className="btn btn-primary" onClick={handleSubmitTask}>
              Submit Task for Review
            </button>
          </div>
        )}

        {/* Review section for task creators and org admins */}
        {user && (task.created_by_id === user.id || userOrgRole === 'admin') && task.status === 'submitted' && (
          <div className="card">
            <h3>Review Submission</h3>
            <p>This task has been submitted for review. You can approve it or send it back for revision.</p>

            <div className="input-group">
              <label htmlFor="review-comments">Comments (required for rejection)</label>
              <textarea
                id="review-comments"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Provide feedback..."
                rows={4}
              />
            </div>

            <div className="review-actions">
              <button
                className="btn btn-danger"
                onClick={() => handleReviewTask('rejected')}
              >
                Reject - Send Back
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleReviewTask('approved')}
              >
                Approve & Complete
              </button>
            </div>
          </div>
        )}

        {/* Delete section for task creators */}
        {user && task.created_by_id === user.id && (
          <div className="card task-actions">
            <button className="btn btn-danger" onClick={handleDeleteTask}>
              Delete Task
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TaskDetailPage;
