import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import './AdminDashboardPage.css';

interface User {
  id: number;
  email: string;
  username?: string;
  name: string;
  role: 'member' | 'admin' | 'super_admin';
  account_status: 'active' | 'suspended' | 'deleted';
  email_verified: boolean;
  created_at: string;
}

interface Organization {
  id: number;
  name: string;
  member_count: number;
}

const AdminDashboardPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    username: '',
    password: '',
    role: 'member' as 'member' | 'admin' | 'super_admin',
    organizationId: '',
    organizationRole: 'member' as 'member' | 'admin',
  });

  useEffect(() => {
    // Check if user is admin
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') {
      navigate('/');
      return;
    }

    loadUsers();
  }, [search, roleFilter, statusFilter, page]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAllUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      });

      setUsers(response.data.users);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'member' | 'admin' | 'super_admin') => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    setActionLoading(userId);
    try {
      await adminAPI.updateUserRole(userId, newRole);
      await loadUsers();
      alert('User role updated successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (userId: number, newStatus: 'active' | 'suspended') => {
    if (!window.confirm(`Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this user?`)) {
      return;
    }

    setActionLoading(userId);
    try {
      await adminAPI.updateUserStatus(userId, newStatus);
      await loadUsers();
      alert(`User ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    setActionLoading(userId);
    try {
      await adminAPI.deleteUser(userId);
      await loadUsers();
      alert('User deleted successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleForcePasswordReset = async (userId: number) => {
    if (!window.confirm('Send password reset email to this user?')) {
      return;
    }

    setActionLoading(userId);
    try {
      await adminAPI.forcePasswordReset(userId);
      alert('Password reset email sent successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send password reset email');
    } finally {
      setActionLoading(null);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await adminAPI.getAllOrganizations();
      setOrganizations(response.data.organizations);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const openCreateModal = () => {
    loadOrganizations();
    setNewUser({
      email: '',
      name: '',
      username: '',
      password: '',
      role: 'member',
      organizationId: '',
      organizationRole: 'member',
    });
    setShowCreateModal(true);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser({ ...newUser, password });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUser.email || !newUser.name || !newUser.password) {
      alert('Please fill in all required fields');
      return;
    }

    if (newUser.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setCreateLoading(true);
    try {
      await adminAPI.createUser({
        email: newUser.email,
        name: newUser.name,
        username: newUser.username || undefined,
        password: newUser.password,
        role: newUser.role,
        organizationId: newUser.organizationId ? parseInt(newUser.organizationId) : undefined,
        organizationRole: newUser.organizationId ? newUser.organizationRole : undefined,
      });

      alert('User created successfully! A welcome email has been sent with their login credentials.');
      setShowCreateModal(false);
      await loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'badge badge-super-admin';
      case 'admin':
        return 'badge badge-admin';
      default:
        return 'badge badge-member';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge badge-success';
      case 'suspended':
        return 'badge badge-warning';
      case 'deleted':
        return 'badge badge-danger';
      default:
        return 'badge';
    }
  };

  if (loading && users.length === 0) {
    return (
      <Layout>
        <div className="admin-dashboard-page">
          <h1>Admin Dashboard</h1>
          <div className="loading">Loading users...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-dashboard-page">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <div className="admin-header-actions">
            <button onClick={openCreateModal} className="btn btn-primary">
              Create User
            </button>
            <Link to="/admin/audit-logs" className="btn btn-secondary">
              View Audit Logs
            </Link>
          </div>
        </div>

        <div className="admin-filters">
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Roles</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-info">
                      <strong>{user.name}</strong>
                      {user.username && <span className="username">@{user.username}</span>}
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(user.account_status)}>
                      {user.account_status}
                    </span>
                  </td>
                  <td>
                    {user.email_verified ? (
                      <span className="badge badge-success">Yes</span>
                    ) : (
                      <span className="badge badge-warning">No</span>
                    )}
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <Link
                        to={`/admin/users/${user.id}`}
                        className="btn btn-sm btn-secondary"
                      >
                        Manage
                      </Link>

                      {user.id !== currentUser?.id && (
                        <>
                          {user.account_status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(user.id, 'suspended')}
                              disabled={actionLoading === user.id}
                              className="btn btn-sm btn-warning"
                            >
                              Suspend
                            </button>
                          ) : user.account_status === 'suspended' ? (
                            <button
                              onClick={() => handleStatusChange(user.id, 'active')}
                              disabled={actionLoading === user.id}
                              className="btn btn-sm btn-success"
                            >
                              Activate
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleForcePasswordReset(user.id)}
                            disabled={actionLoading === user.id}
                            className="btn btn-sm btn-secondary"
                            title="Send password reset email"
                          >
                            Reset PW
                          </button>

                          {user.account_status !== 'deleted' && (
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={actionLoading === user.id}
                              className="btn btn-sm btn-danger"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
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

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content create-user-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New User</h2>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    required
                    placeholder="John Doe"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="username">Username (optional)</label>
                  <input
                    type="text"
                    id="username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="johndoe"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <div className="password-input-group">
                    <input
                      type="text"
                      id="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                    />
                    <button type="button" onClick={generatePassword} className="btn btn-sm btn-secondary">
                      Generate
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="role">System Role</label>
                  <select
                    id="role"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    {currentUser?.role === 'super_admin' && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="organization">Assign to Organization (optional)</label>
                  <select
                    id="organization"
                    value={newUser.organizationId}
                    onChange={(e) => setNewUser({ ...newUser, organizationId: e.target.value })}
                  >
                    <option value="">-- No Organization --</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.member_count} members)
                      </option>
                    ))}
                  </select>
                </div>

                {newUser.organizationId && (
                  <div className="form-group">
                    <label htmlFor="orgRole">Organization Role</label>
                    <select
                      id="orgRole"
                      value={newUser.organizationRole}
                      onChange={(e) => setNewUser({ ...newUser, organizationRole: e.target.value as any })}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                )}

                <div className="form-info">
                  <p>* User will be created with email verified status</p>
                  <p>* A welcome email will be sent with login credentials</p>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                    disabled={createLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createLoading}>
                    {createLoading ? 'Creating...' : 'Create User'}
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

export default AdminDashboardPage;
