import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import './AdminAuditLogsPage.css';

interface AuditLog {
  id: number;
  action: string;
  details: any;
  ip_address: string;
  created_at: string;
  admin_id: number;
  admin_name: string;
  admin_email: string;
  target_user_id?: number;
  target_user_name?: string;
  target_user_email?: string;
}

const AdminAuditLogsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Check if user is admin
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
      navigate('/');
      return;
    }

    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAuditLogs({ page, limit: 50 });
      setLogs(response.data.logs);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      alert('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading && logs.length === 0) {
    return (
      <Layout>
        <div className="admin-audit-logs-page">
          <h1>Audit Logs</h1>
          <div className="loading">Loading audit logs...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-audit-logs-page">
        <div className="audit-header">
          <h1>Audit Logs</h1>
          <Link to="/admin" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>

        <div className="logs-table-container">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target User</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>
                    <div className="user-info">
                      <strong>{log.admin_name}</strong>
                      <span className="email">{log.admin_email}</span>
                    </div>
                  </td>
                  <td>
                    <span className="action-badge">{formatAction(log.action)}</span>
                  </td>
                  <td>
                    {log.target_user_name ? (
                      <div className="user-info">
                        <strong>{log.target_user_name}</strong>
                        <span className="email">{log.target_user_email}</span>
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="ip-address">{log.ip_address}</td>
                  <td>
                    {log.details && (
                      <pre className="details-pre">{JSON.stringify(log.details, null, 2)}</pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <span className="page-info">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminAuditLogsPage;
