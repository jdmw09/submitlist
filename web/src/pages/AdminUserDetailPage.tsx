import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import './AdminUserDetailPage.css';

interface User {
  id: number;
  email: string;
  username?: string;
  name: string;
  role: 'member' | 'admin' | 'super_admin';
  account_status: 'active' | 'suspended' | 'deleted';
  email_verified: boolean;
  email_verified_at?: string;
  created_at: string;
}

interface Organization {
  id: number;
  name: string;
  description?: string;
  role: 'member' | 'admin';
  joined_at: string;
  member_count: number;
}

interface AllOrganization {
  id: number;
  name: string;
  description?: string;
  member_count: number;
}

const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<AllOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin'>('member');

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
      navigate('/');
      return;
    }

    loadUserDetails();
    loadAllOrganizations();
  }, [id]);

  const loadUserDetails = async () => {
    setLoading(true);
    try {
      const [userResponse, orgsResponse] = await Promise.all([
        adminAPI.getUserById(Number(id)),
        adminAPI.getUserOrganizations(Number(id)),
      ]);

      setUser(userResponse.data.user);
      setOrganizations(orgsResponse.data.organizations);
    } catch (error: any) {
      console.error('Failed to load user details:', error);
      alert('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const loadAllOrganizations = async () => {
    try {
      const response = await adminAPI.getAllOrganizations();
      setAllOrganizations(response.data.organizations);
    } catch (error: any) {
      console.error('Failed to load organizations:', error);
    }
  };

  const handleAddToOrganization = async () => {
    if (!selectedOrgId) {
      alert('Please select an organization');
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.addUserToOrganization(Number(id), selectedOrgId, selectedRole);
      await loadUserDetails();
      setShowAddOrgModal(false);
      setSelectedOrgId(null);
      setSelectedRole('member');
      alert('User added to organization successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add user to organization');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromOrganization = async (orgId: number, orgName: string) => {
    if (!window.confirm(`Remove user from "${orgName}"?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.removeUserFromOrganization(Number(id), orgId);
      await loadUserDetails();
      alert('User removed from organization successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove user from organization');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateOrgRole = async (orgId: number, currentRole: string, orgName: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    if (!window.confirm(`Change user's role in "${orgName}" to ${newRole}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.updateUserOrganizationRole(Number(id), orgId, newRole);
      await loadUserDetails();
      alert('User role updated successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user role');
    } finally {
      setActionLoading(false);
    }
  };

  const getAvailableOrganizations = () => {
    const userOrgIds = organizations.map(org => org.id);
    return allOrganizations.filter(org => !userOrgIds.includes(org.id));
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading user details...</div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="error">User not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-user-detail">
        <div className="page-header">
          <Link to="/admin" className="back-link">← Back to Admin Dashboard</Link>
          <h1>User Details</h1>
        </div>

        <div className="user-info-card">
          <h2>User Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Name:</label>
              <span>{user.name}</span>
            </div>
            <div className="info-item">
              <label>Email:</label>
              <span>{user.email}</span>
            </div>
            <div className="info-item">
              <label>Username:</label>
              <span>{user.username || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Role:</label>
              <span className={`badge badge-${user.role}`}>{user.role}</span>
            </div>
            <div className="info-item">
              <label>Account Status:</label>
              <span className={`badge badge-${user.account_status}`}>{user.account_status}</span>
            </div>
            <div className="info-item">
              <label>Email Verified:</label>
              <span className={`badge ${user.email_verified ? 'badge-success' : 'badge-warning'}`}>
                {user.email_verified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="info-item">
              <label>Created:</label>
              <span>{new Date(user.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="organizations-section">
          <div className="section-header">
            <h2>Organizations ({organizations.length})</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddOrgModal(true)}
              disabled={actionLoading}
            >
              Add to Organization
            </button>
          </div>

          {organizations.length === 0 ? (
            <div className="empty-state">
              User is not a member of any organizations
            </div>
          ) : (
            <div className="organizations-list">
              {organizations.map(org => (
                <div key={org.id} className="org-card">
                  <div className="org-info">
                    <h3>{org.name}</h3>
                    {org.description && <p>{org.description}</p>}
                    <div className="org-meta">
                      <span className={`badge badge-${org.role}`}>
                        {org.role}
                      </span>
                      <span className="member-count">
                        {org.member_count} member{org.member_count !== 1 ? 's' : ''}
                      </span>
                      <span className="joined-date">
                        Joined: {new Date(org.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="org-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleUpdateOrgRole(org.id, org.role, org.name)}
                      disabled={actionLoading}
                    >
                      {org.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveFromOrganization(org.id, org.name)}
                      disabled={actionLoading}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showAddOrgModal && (
          <div className="modal-overlay" onClick={() => setShowAddOrgModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add User to Organization</h2>
                <button className="close-btn" onClick={() => setShowAddOrgModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Organization:</label>
                  <select
                    value={selectedOrgId || ''}
                    onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                    className="form-control"
                  >
                    <option value="">Choose an organization...</option>
                    {getAvailableOrganizations().map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.member_count} members)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Role:</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'member' | 'admin')}
                    className="form-control"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddOrgModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleAddToOrganization}
                  disabled={actionLoading || !selectedOrgId}
                >
                  {actionLoading ? 'Adding...' : 'Add to Organization'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminUserDetailPage;
