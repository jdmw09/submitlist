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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadOrganizationDetails();
    loadJoinRequests();
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
