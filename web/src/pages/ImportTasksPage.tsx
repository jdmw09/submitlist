import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskAPI } from '../services/api';
import Layout from '../components/Layout';
import './ImportTasksPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://submitlist.space/api';

interface ImportError {
  row: number;
  column?: string;
  error: string;
  data: any;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    tasksCreated: number;
    errors: ImportError[];
  };
}

const ImportTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [validateOnly, setValidateOnly] = useState(false);
  const [notifyAssignees, setNotifyAssignees] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks/import/template`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'task_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download template');
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('Please select a CSV file');
      return;
    }

    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) {
      alert('No organization selected');
      return;
    }

    const org = JSON.parse(storedOrg);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', org.id.toString());
    formData.append('validateOnly', validateOnly.toString());
    formData.append('notifyAssignees', notifyAssignees.toString());

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/tasks/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      const data = await response.json();
      setResult(data);

      if (data.success && !validateOnly) {
        alert(`Successfully imported ${data.stats.tasksCreated} tasks!`);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to import tasks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="import-tasks-page">
        <div className="page-header">
          <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
            ← Back to Tasks
          </button>
          <h1>Import Tasks from CSV</h1>
        </div>

        <div className="import-card">
          <div className="section">
            <h2>Step 1: Download Template</h2>
            <p>Download the CSV template to see the required format and example data.</p>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
              Download Template
            </button>
          </div>

          <div className="section">
            <h2>Step 2: Upload Your CSV File</h2>
            <div className="file-input-wrapper">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="file-input"
                id="csv-file"
              />
              <label htmlFor="csv-file" className="file-input-label">
                {file ? file.name : 'Choose CSV File'}
              </label>
            </div>
          </div>

          <div className="section">
            <h2>Step 3: Import Options</h2>
            <div className="options">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={validateOnly}
                  onChange={(e) => setValidateOnly(e.target.checked)}
                />
                <span>Validate Only (don't create tasks)</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={notifyAssignees}
                  onChange={(e) => setNotifyAssignees(e.target.checked)}
                />
                <span>Send notifications to assigned users</span>
              </label>
            </div>
          </div>

          <div className="section">
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!file || loading}
            >
              {loading ? 'Processing...' : validateOnly ? 'Validate CSV' : 'Import Tasks'}
            </button>
          </div>

          {result && (
            <div className={`result-section ${result.success ? 'success' : 'warning'}`}>
              <h2>Import Results</h2>
              <div className="stats">
                <div className="stat-item">
                  <span className="stat-label">Total Rows:</span>
                  <span className="stat-value">{result.stats.totalRows}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Valid Rows:</span>
                  <span className="stat-value success">{result.stats.validRows}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Invalid Rows:</span>
                  <span className="stat-value error">{result.stats.invalidRows}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Tasks Created:</span>
                  <span className="stat-value">{result.stats.tasksCreated}</span>
                </div>
              </div>

              {result.stats.errors.length > 0 && (
                <div className="errors-section">
                  <h3>Errors ({result.stats.errors.length})</h3>
                  <div className="errors-list">
                    {result.stats.errors.map((error, index) => (
                      <div key={index} className="error-item">
                        <div className="error-header">
                          <span className="error-row">Row {error.row}</span>
                          {error.column && <span className="error-column">{error.column}</span>}
                        </div>
                        <div className="error-message">{error.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="result-message">{result.message}</p>
            </div>
          )}
        </div>

        <div className="help-section">
          <h3>CSV Format Requirements</h3>
          <ul>
            <li><strong>title</strong> (required): Task title (max 255 characters)</li>
            <li><strong>organization_id</strong> (required): Your organization ID</li>
            <li><strong>details</strong> (optional): Task description</li>
            <li><strong>assigned_user_emails</strong> (optional): Comma-separated emails (max 50)</li>
            <li><strong>start_date</strong> (optional): YYYY-MM-DD format</li>
            <li><strong>end_date</strong> (optional): YYYY-MM-DD format (must be after start_date)</li>
            <li><strong>schedule_type</strong> (optional): one_time, daily, weekly, or monthly</li>
            <li><strong>is_private</strong> (optional): true or false</li>
            <li><strong>group_name</strong> (optional): Name of existing group</li>
            <li><strong>requirements</strong> (optional): Pipe-separated (|) requirements (max 50, 500 chars each)</li>
            <li><strong>status</strong> (optional): pending, in_progress, submitted, or completed</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default ImportTasksPage;
