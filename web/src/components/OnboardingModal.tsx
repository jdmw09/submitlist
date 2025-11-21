import React, { useState, useEffect } from 'react';
import { organizationAPI } from '../services/api';
import './OnboardingModal.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PublicOrganization {
  id: number;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'choice' | 'invite' | 'browse' | 'create'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Browse organizations state
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [joinMessage, setJoinMessage] = useState('');

  useEffect(() => {
    if (step === 'browse') {
      loadPublicOrganizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, searchQuery]);

  const loadPublicOrganizations = async () => {
    try {
      const response = await organizationAPI.getPublicOrganizations(searchQuery);
      setOrganizations(response.data.organizations);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await organizationAPI.acceptInvite(inviteCode);
      alert('Successfully joined organization!');
      onClose();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await organizationAPI.create(orgName, orgDescription, true, false);
      localStorage.setItem('selectedOrganization', JSON.stringify(response.data.organization));
      alert('Organization created successfully!');
      onClose();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestToJoin = async (organizationId: number) => {
    setLoading(true);
    setError('');

    try {
      await organizationAPI.createJoinRequest(organizationId, joinMessage);
      alert('Join request submitted successfully! You will be notified when an admin reviews your request.');
      onClose();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit join request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome! Let's Get Started</h2>

        {step === 'choice' && (
          <div className="onboarding-choice">
            <p>Choose how you'd like to proceed:</p>

            <div className="choice-cards">
              <div className="choice-card" onClick={() => setStep('invite')}>
                <div className="choice-icon">📬</div>
                <h3>Join with Invite Code</h3>
                <p>Have an invite code? Join an existing organization instantly.</p>
              </div>

              <div className="choice-card" onClick={() => setStep('browse')}>
                <div className="choice-icon">🔍</div>
                <h3>Browse Organizations</h3>
                <p>Find and request to join public organizations.</p>
              </div>

              <div className="choice-card" onClick={() => setStep('create')}>
                <div className="choice-icon">➕</div>
                <h3>Create New Organization</h3>
                <p>Start your own organization and invite others.</p>
              </div>
            </div>

            <button onClick={onClose} className="btn-skip">
              Skip for Now
            </button>
          </div>
        )}

        {step === 'invite' && (
          <div className="onboarding-step">
            <button onClick={() => setStep('choice')} className="btn-back">
              ← Back
            </button>
            <h3>Join with Invite Code</h3>
            <p>Enter the invite code you received:</p>

            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="invite-code-input"
              maxLength={19}
            />

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button onClick={handleJoinWithCode} disabled={loading} className="btn-primary">
                {loading ? 'Joining...' : 'Join Organization'}
              </button>
            </div>
          </div>
        )}

        {step === 'browse' && (
          <div className="onboarding-step">
            <button onClick={() => setStep('choice')} className="btn-back">
              ← Back
            </button>
            <h3>Browse Organizations</h3>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search organizations..."
              className="search-input"
            />

            <div className="organizations-list">
              {organizations.length === 0 ? (
                <p className="no-results">No public organizations found</p>
              ) : (
                organizations.map((org) => (
                  <div key={org.id} className="organization-card">
                    <div className="org-info">
                      <h4>{org.name}</h4>
                      <p>{org.description || 'No description provided'}</p>
                      <span className="member-count">{org.member_count} members</span>
                    </div>
                    <button
                      onClick={() => setSelectedOrgId(org.id)}
                      className="btn-join"
                    >
                      Request to Join
                    </button>
                  </div>
                ))
              )}
            </div>

            {selectedOrgId && (
              <div className="join-request-form">
                <h4>Request to Join</h4>
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  placeholder="Tell the admins why you want to join (optional)"
                  rows={3}
                  className="join-message-input"
                />
                {error && <div className="error-message">{error}</div>}
                <div className="modal-actions">
                  <button onClick={() => setSelectedOrgId(null)} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRequestToJoin(selectedOrgId)}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'create' && (
          <div className="onboarding-step">
            <button onClick={() => setStep('choice')} className="btn-back">
              ← Back
            </button>
            <h3>Create New Organization</h3>
            <p>Choose a name for your organization:</p>

            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization Name"
              className="org-name-input"
              maxLength={100}
            />

            <textarea
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="org-description-input"
              maxLength={500}
            />

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button onClick={handleCreateOrganization} disabled={loading} className="btn-primary">
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
