import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationAPI } from '../services/api';
import { Organization } from '../types';
import Layout from '../components/Layout';
import './OrganizationsPage.css';

interface PublicOrganization {
  id: number;
  name: string;
  description?: string;
  member_count: number;
}

const OrganizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Join organization state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<PublicOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [loadingAvailableOrgs, setLoadingAvailableOrgs] = useState(false);
  const joinModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      // Focus trap: handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowCreateModal(false);
        }

        // Focus trap: keep focus within modal
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'button, input, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            // Tab
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showCreateModal]);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await organizationAPI.getAll();
      setOrganizations(response.data.organizations);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const selectOrganization = (org: Organization) => {
    localStorage.setItem('selectedOrganization', JSON.stringify(org));
    navigate('/');
  };

  const handleOrgCardKeyDown = (e: React.KeyboardEvent, org: Organization) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectOrganization(org);
    }
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowCreateModal(false);
    }
  };

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      alert('Please enter an organization name');
      return;
    }

    try {
      await organizationAPI.create(newOrgName);
      setNewOrgName('');
      setShowCreateModal(false);
      loadOrganizations();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create organization');
    }
  };

  const loadAvailableOrganizations = async () => {
    setLoadingAvailableOrgs(true);
    try {
      const response = await organizationAPI.getPublicOrganizations();
      const publicOrgs: PublicOrganization[] = response.data.organizations || [];
      // Filter out organizations the user is already a member of
      const memberOrgIds = new Set(organizations.map(org => org.id));
      const available = publicOrgs.filter(org => !memberOrgIds.has(org.id));
      setAvailableOrgs(available);
    } catch (error: any) {
      console.error('Failed to load available organizations:', error);
      setAvailableOrgs([]);
    } finally {
      setLoadingAvailableOrgs(false);
    }
  };

  const openJoinModal = () => {
    setShowJoinModal(true);
    loadAvailableOrganizations();
  };

  const closeJoinModal = () => {
    setShowJoinModal(false);
    setSelectedOrgId(null);
    setJoinMessage('');
  };

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) {
      alert('Please select an organization to join');
      return;
    }

    try {
      await organizationAPI.createJoinRequest(selectedOrgId, joinMessage);
      alert('Join request sent successfully! You will be notified when it is reviewed.');
      closeJoinModal();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send join request');
    }
  };

  return (
    <Layout>
      <div className="organizations-page">
        <div className="page-header">
          <h1>Organizations</h1>
          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={openJoinModal}
            >
              Join Organization
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Organization
            </button>
          </div>
        </div>

        {showCreateModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowCreateModal(false)}
            onKeyDown={handleOverlayKeyDown}
            aria-hidden="true"
          >
            <div
              ref={modalRef}
              className="modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <h2 id="modal-title">Create Organization</h2>
              <form onSubmit={createOrganization}>
                <div className="input-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Enter organization name"
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showJoinModal && (
          <div
            className="modal-overlay"
            onClick={closeJoinModal}
            aria-hidden="true"
          >
            <div
              ref={joinModalRef}
              className="modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="join-modal-title"
            >
              <h2 id="join-modal-title">Join Organization</h2>
              <form onSubmit={handleJoinRequest}>
                <div className="input-group">
                  <label>Select Organization</label>
                  {loadingAvailableOrgs ? (
                    <select disabled>
                      <option>Loading...</option>
                    </select>
                  ) : availableOrgs.length === 0 ? (
                    <select disabled>
                      <option>N/A - No organizations available to join</option>
                    </select>
                  ) : (
                    <select
                      value={selectedOrgId || ''}
                      onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : null)}
                      autoFocus
                    >
                      <option value="">Select an organization...</option>
                      {availableOrgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.member_count} members)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {availableOrgs.length > 0 && selectedOrgId && (
                  <div className="input-group">
                    <label>Message (optional)</label>
                    <textarea
                      value={joinMessage}
                      onChange={(e) => setJoinMessage(e.target.value)}
                      placeholder="Why do you want to join this organization?"
                      rows={3}
                    />
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeJoinModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!selectedOrgId || availableOrgs.length === 0}
                  >
                    Request to Join
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading organizations...</div>
        ) : organizations.length === 0 ? (
          <div className="empty">
            <p>No organizations yet</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Create your first organization
            </button>
          </div>
        ) : (
          <div className="orgs-grid">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="org-card"
                onClick={() => selectOrganization(org)}
                onKeyDown={(e) => handleOrgCardKeyDown(e, org)}
                tabIndex={0}
                role="button"
                aria-label={`Select ${org.name} organization where you are ${org.role}`}
              >
                <div className="org-icon">{org.name.charAt(0).toUpperCase()}</div>
                <div className="org-info">
                  <h3>{org.name}</h3>
                  <span className="org-role">{org.role}</span>
                </div>
                <div className="org-arrow">→</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OrganizationsPage;
