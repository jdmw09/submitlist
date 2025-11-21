import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskAPI } from '../services/api';
import './TaskAuditLogPage.css';

interface AuditLog {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: number;
  changes: any;
  metadata: any;
  created_at: string;
}

const TaskAuditLogPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [id]);

  const loadAuditLogs = async () => {
    try {
      const response = await taskAPI.getAuditLogs(Number(id));
      setLogs(response.data.logs);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      alert(error.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return '➕';
      case 'updated':
      case 'status_changed':
        return '✏️';
      case 'deleted':
        return '🗑️';
      case 'submitted':
        return '📤';
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      case 'requirement_completed':
        return '☑️';
      default:
        return '📝';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return 'Created Task';
      case 'updated':
        return 'Updated Task';
      case 'status_changed':
        return 'Changed Status';
      case 'deleted':
        return 'Deleted Task';
      case 'submitted':
        return 'Submitted Task';
      case 'approved':
        return 'Approved Task';
      case 'rejected':
        return 'Rejected Task';
      case 'requirement_completed':
        return 'Completed Requirement';
      default:
        return action;
    }
  };

  const renderChanges = (changes: any) => {
    if (!changes) return null;

    return (
      <div className="audit-changes">
        {Object.entries(changes).map(([key, value]: [string, any]) => (
          <div key={key} className="audit-change-item">
            <span className="change-field">{key}:</span>
            {value.before !== undefined && (
              <span className="change-before">
                {typeof value.before === 'object' ? JSON.stringify(value.before) : String(value.before || 'null')}
              </span>
            )}
            <span className="change-arrow">→</span>
            <span className="change-after">
              {typeof value.after === 'object' ? JSON.stringify(value.after) : String(value.after || 'null')}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderMetadata = (metadata: any) => {
    if (!metadata) return null;

    return (
      <div className="audit-metadata">
        <strong>Additional Info:</strong>
        {Object.entries(metadata).map(([key, value]: [string, any]) => (
          <div key={key} className="metadata-item">
            <span className="metadata-key">{key}:</span>
            <span className="metadata-value">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading audit logs...</div>;
  }

  return (
    <div className="audit-log-page">
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate(`/tasks/${id}`)}>
          ← Back to Task
        </button>
        <h1>Task Audit Log</h1>
      </div>

      <div className="audit-timeline">
        {logs.length === 0 ? (
          <div className="no-logs">No audit logs found for this task.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="audit-log-item">
              <div className="audit-icon">{getActionIcon(log.action)}</div>
              <div className="audit-content">
                <div className="audit-header">
                  <span className="audit-action">{getActionLabel(log.action)}</span>
                  <span className="audit-user">{log.user_name}</span>
                  <span className="audit-date">{formatDate(log.created_at)}</span>
                </div>
                {renderChanges(log.changes)}
                {renderMetadata(log.metadata)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskAuditLogPage;
