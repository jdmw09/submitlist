import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskAPI, organizationAPI } from '../services/api';
import Layout from '../components/Layout';
import './CreateTaskPage.css';

const CreateTaskPage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [scheduleType, setScheduleType] = useState<'one_time' | 'daily' | 'weekly' | 'monthly'>('one_time');
  const [scheduleFrequency, setScheduleFrequency] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [groupId, setGroupId] = useState<number | undefined>();
  const [isPrivate, setIsPrivate] = useState(false);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrgMembers();
    loadGroups();
  }, []);

  const loadOrgMembers = async () => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    console.log('Stored organization:', storedOrg);
    if (storedOrg) {
      const org = JSON.parse(storedOrg);
      console.log('Parsed organization:', org);
      try {
        const response = await organizationAPI.getMembers(org.id);
        console.log('Members response:', response.data);
        console.log('Members array:', response.data.members);
        setOrgMembers(response.data.members || []);
      } catch (error: any) {
        console.error('Failed to load organization members:', error);
        console.error('Error response:', error.response?.data);
        alert(`Failed to load organization members: ${error.response?.data?.error || error.message}`);
      }
    } else {
      console.warn('No organization selected in localStorage');
      alert('Please select an organization first from the Organizations page');
    }
  };

  const loadGroups = async () => {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (storedOrg) {
      const org = JSON.parse(storedOrg);
      try {
        const response = await organizationAPI.getGroups(org.id);
        setGroups(response.data.groups || []);
      } catch (error: any) {
        console.error('Failed to load groups:', error);
      }
    }
  };

  const addRequirement = () => {
    setRequirements([...requirements, '']);
  };

  const updateRequirement = (index: number, value: string) => {
    const updated = [...requirements];
    updated[index] = value;
    setRequirements(updated);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }

    const storedOrg = localStorage.getItem('selectedOrganization');
    if (!storedOrg) {
      alert('No organization selected');
      navigate('/organizations');
      return;
    }

    const org = JSON.parse(storedOrg);
    const validRequirements = requirements.filter(r => r.trim());

    setLoading(true);
    try {
      await taskAPI.create({
        organizationId: org.id,
        title,
        details,
        requirements: validRequirements,
        scheduleType,
        scheduleFrequency: scheduleType !== 'one_time' ? scheduleFrequency : 1,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        assignedUserIds: assignedUserIds.length > 0 ? assignedUserIds : undefined,
        groupId: groupId || undefined,
        isPrivate,
      });

      navigate('/');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (userId: number) => {
    if (assignedUserIds.includes(userId)) {
      setAssignedUserIds(assignedUserIds.filter(id => id !== userId));
    } else {
      setAssignedUserIds([...assignedUserIds, userId]);
    }
  };

  return (
    <Layout>
      <div className="create-task-page">
        <h1>Create New Task</h1>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="input-group">
            <label>Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
            />
          </div>

          <div className="input-group">
            <label>Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Enter task details"
              rows={4}
            />
          </div>

          {scheduleType === 'one_time' ? (
            <div className="input-group">
              <label>Due Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="date-row">
              <div className="input-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>End Date (optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Assign To Group (optional)</label>
            <select
              value={groupId || ''}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.member_count} members)
                </option>
              ))}
            </select>
            <small>Selecting a group will automatically assign all group members</small>
          </div>

          <div className="input-group">
            <label>Assign To Members (optional)</label>
            <div className="assignee-list">
              {orgMembers.length === 0 ? (
                <p className="no-members">No organization members found</p>
              ) : (
                orgMembers.map((member) => (
                  <label key={member.user_id} className="assignee-checkbox">
                    <input
                      type="checkbox"
                      checked={assignedUserIds.includes(member.user_id)}
                      onChange={() => toggleAssignee(member.user_id)}
                    />
                    <span>{member.user_name} ({member.role})</span>
                  </label>
                ))
              )}
            </div>
            {assignedUserIds.length > 0 && (
              <small>{assignedUserIds.length} member(s) selected</small>
            )}
          </div>

          <div className="input-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>Private Task (only assigned members can see this task)</span>
            </label>
          </div>

          <div className="requirements-section">
            <label>Requirements</label>
            {requirements.map((req, index) => (
              <div key={index} className="requirement-row">
                <textarea
                  value={req}
                  onChange={(e) => updateRequirement(index, e.target.value)}
                  placeholder={`Requirement ${index + 1}`}
                  rows={3}
                />
                {requirements.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeRequirement(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addRequirement}
            >
              + Add Requirement
            </button>
          </div>

          <div className="input-group">
            <label>Schedule Type</label>
            <div className="schedule-options">
              {['one_time', 'daily', 'weekly', 'monthly'].map((type) => (
                <label key={type} className="schedule-option">
                  <input
                    type="radio"
                    name="scheduleType"
                    value={type}
                    checked={scheduleType === type}
                    onChange={(e) => setScheduleType(e.target.value as any)}
                  />
                  <span>{type.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
            {scheduleType !== 'one_time' && (
              <>
                <div className="frequency-row">
                  <label>Repeat every</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(Math.max(1, parseInt(e.target.value) || 1))}
                    className="frequency-input"
                  />
                  <span>
                    {scheduleType === 'daily' && (scheduleFrequency === 1 ? 'day' : 'days')}
                    {scheduleType === 'weekly' && (scheduleFrequency === 1 ? 'week' : 'weeks')}
                    {scheduleType === 'monthly' && (scheduleFrequency === 1 ? 'month' : 'months')}
                  </span>
                </div>
                <div className="schedule-info">
                  <p>
                    <strong>Recurring Task:</strong> This task will automatically generate new instances{' '}
                    {scheduleType === 'daily' && (scheduleFrequency === 1 ? 'every day' : `every ${scheduleFrequency} days`)}
                    {scheduleType === 'weekly' && (scheduleFrequency === 1 ? 'every week' : `every ${scheduleFrequency} weeks`)}
                    {scheduleType === 'monthly' && (scheduleFrequency === 1 ? 'every month' : `every ${scheduleFrequency} months`)}
                    {startDate && ' starting on the specified start date'}
                    {endDate && ' and ending on the end date'}.
                    {!endDate && ' with no end date (continues indefinitely)'}.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CreateTaskPage;
