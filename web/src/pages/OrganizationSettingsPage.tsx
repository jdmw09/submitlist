import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationAPI } from '../services/api';
import Layout from '../components/Layout';
import './OrganizationSettingsPage.css';

interface Member {
  id: number;
  user_id: number;
  email: string;
  user_name: string;
  role: string;
  joined_at: string;
}

interface JoinRequest {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  message: string;
  created_at: string;
  status: string;
}

interface TaskSettings {
  default_task_sort: 'due_date' | 'priority';
  hide_completed_tasks: boolean;
  auto_archive_enabled: boolean;
  auto_archive_after_days: number;
  archive_schedule: 'daily' | 'weekly_sunday' | 'weekly_monday';
}

const OrganizationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [taskSettings, setTaskSettings] = useState<TaskSettings>({
    default_task_sort: 'due_date',
    hide_completed_tasks: false,
    auto_archive_enabled: false,
    auto_archive_after_days: 7,
    archive_schedule: 'daily',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const loadOrganizationDetails = async () => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) {
      navigate('/organizations');
      return;
    }

    const org = JSON.parse(storedOrg);
    setLoading(true);

    try {
      const response = await organizationAPI.getDetails(org.id);
      setOrgName(response.data.organization.name);
      setUserRole(response.data.userRole);
      setMembers(response.data.members);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  const loadJoinRequests = async () => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    try {
      const response = await organizationAPI.getJoinRequests(org.id, 'pending');
      setJoinRequests(response.data.requests);
    } catch (error) {
      console.error('Failed to load join requests:', error);
    }
  };

  const loadTaskSettings = async () => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    try {
      const response = await organizationAPI.getSettings(org.id);
      const settings = response.data.settings;
      if (settings) {
        setTaskSettings({
          default_task_sort: settings.default_task_sort || 'due_date',
          hide_completed_tasks: settings.hide_completed_tasks || false,
          auto_archive_enabled: settings.auto_archive_enabled || false,
          auto_archive_after_days: settings.auto_archive_after_days || 7,
          archive_schedule: settings.archive_schedule || 'daily',
        });
      }
    } catch (error) {
      console.error('Failed to load task settings:', error);
    }
  };

  const saveTaskSettings = async () => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    setSavingSettings(true);
    try {
      await organizationAPI.updateSettings(org.id, {
        defaultTaskSort: taskSettings.default_task_sort,
        hideCompletedTasks: taskSettings.hide_completed_tasks,
        autoArchiveEnabled: taskSettings.auto_archive_enabled,
        autoArchiveAfterDays: taskSettings.auto_archive_after_days,
        archiveSchedule: taskSettings.archive_schedule,
      });
      alert('Task settings updated successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadOrganizationDetails();
    loadJoinRequests();
    loadTaskSettings();
  }, []);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMemberEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    try {
      await organizationAPI.addMember(org.id, newMemberEmail, newMemberRole);
      setNewMemberEmail('');
      setNewMemberRole('member');
      setShowAddModal(false);
      loadOrganizationDetails();
      alert('Member added successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add member');
    }
  };

  const updateRole = async (memberId: number, newRole: string) => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    if (!window.confirm(`Change this member's role to ${newRole}?`)) {
      return;
    }

    try {
      await organizationAPI.updateMemberRole(org.id, memberId, newRole);
      loadOrganizationDetails();
      alert('Member role updated successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update member role');
    }
  };

  const removeMember = async (memberId: number, memberName: string) => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    if (!window.confirm(`Remove ${memberName} from this organization?`)) {
      return;
    }

    try {
      await organizationAPI.removeMember(org.id, memberId);
      loadOrganizationDetails();
      alert('Member removed successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleJoinRequest = async (requestId: number, action: 'approved' | 'rejected') => {
    try {
      await organizationAPI.reviewJoinRequest(requestId, action);
      loadJoinRequests();
      if (action === 'approved') {
        loadOrganizationDetails();
      }
      alert(`Request ${action} successfully`);
    } catch (error: any) {
      alert(error.response?.data?.error || `Failed to ${action} request`);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <Layout>
      <div className="org-settings-page">
        <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
          ← Back to Tasks
        </button>

        <h1>{orgName} Settings</h1>

        <div className="settings-section">
          <div className="section-header">
            <h2>Members ({members.length})</h2>
            {isAdmin && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
              >
                + Add Member
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">Loading members...</div>
          ) : (
            <div className="members-list">
              {members.map((member) => (
                <div key={member.user_id} className="member-card">
                  <div className="member-info">
                    <div className="member-avatar">
                      {(member.user_name || member.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="member-details">
                      <h3>{member.user_name || 'Unknown'}</h3>
                      <p>{member.email}</p>
                    </div>
                  </div>

                  <div className="member-actions">
                    {isAdmin ? (
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member.user_id, e.target.value)}
                        className="role-select"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className="role-badge">{member.role}</span>
                    )}

                    {isAdmin && members.length > 1 && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeMember(member.user_id, member.user_name)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="settings-section">
            <h2>Task Settings</h2>
            <div className="task-settings-form">
              <div className="setting-row">
                <label htmlFor="default-sort">Default Sort Order</label>
                <select
                  id="default-sort"
                  value={taskSettings.default_task_sort}
                  onChange={(e) => setTaskSettings({ ...taskSettings, default_task_sort: e.target.value as 'due_date' | 'priority' })}
                  className="setting-select"
                >
                  <option value="due_date">Due Date</option>
                  <option value="priority">Priority</option>
                </select>
              </div>

              <div className="setting-row">
                <label htmlFor="hide-completed">
                  <input
                    type="checkbox"
                    id="hide-completed"
                    checked={taskSettings.hide_completed_tasks}
                    onChange={(e) => setTaskSettings({ ...taskSettings, hide_completed_tasks: e.target.checked })}
                  />
                  Hide Completed Tasks by Default
                </label>
              </div>

              <div className="setting-row">
                <label htmlFor="auto-archive">
                  <input
                    type="checkbox"
                    id="auto-archive"
                    checked={taskSettings.auto_archive_enabled}
                    onChange={(e) => setTaskSettings({ ...taskSettings, auto_archive_enabled: e.target.checked })}
                  />
                  Enable Auto-Archive for Completed Tasks
                </label>
              </div>

              {taskSettings.auto_archive_enabled && (
                <>
                  <div className="setting-row indented">
                    <label htmlFor="archive-days">Archive After</label>
                    <select
                      id="archive-days"
                      value={taskSettings.auto_archive_after_days}
                      onChange={(e) => setTaskSettings({ ...taskSettings, auto_archive_after_days: parseInt(e.target.value) })}
                      className="setting-select"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>

                  <div className="setting-row indented">
                    <label htmlFor="archive-schedule">Archive Schedule</label>
                    <select
                      id="archive-schedule"
                      value={taskSettings.archive_schedule}
                      onChange={(e) => setTaskSettings({ ...taskSettings, archive_schedule: e.target.value as 'daily' | 'weekly_sunday' | 'weekly_monday' })}
                      className="setting-select"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly_sunday">Weekly (Sunday)</option>
                      <option value="weekly_monday">Weekly (Monday)</option>
                    </select>
                  </div>
                </>
              )}

              <button
                className="btn btn-primary save-settings-btn"
                onClick={saveTaskSettings}
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {isAdmin && joinRequests.length > 0 && (
          <div className="settings-section">
            <h2>Pending Join Requests ({joinRequests.length})</h2>
            <div className="join-requests-list">
              {joinRequests.map((request) => (
                <div key={request.id} className="member-card join-request-card">
                  <div className="member-info">
                    <div className="member-avatar">
                      {(request.user_name || request.user_email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="member-details">
                      <h3>{request.user_name || 'Unknown'}</h3>
                      <p>{request.user_email}</p>
                      {request.message && (
                        <p className="request-message">
                          <em>"{request.message}"</em>
                        </p>
                      )}
                      <p className="request-date">
                        Requested: {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="member-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleJoinRequest(request.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleJoinRequest(request.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Add Member</h2>
              <form onSubmit={addMember}>
                <div className="input-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label>Role</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Member
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OrganizationSettingsPage;
