'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GroupMetadata } from '@/types';

export default function GroupManagement() {
  const [groups, setGroups] = useState<GroupMetadata[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  // Auto-dismiss message based on length (4 seconds base + 1 second per 10 characters after 15)
  useEffect(() => {
    if (message) {
      const baseTime = 4000; // 4 seconds
      const extraTime = message.length > 15 ? Math.floor((message.length - 15) / 10) * 1000 : 0;
      const timeout = baseTime + extraTime;
      
      const timer = setTimeout(() => {
        setMessage('');
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const [newGroup, setNewGroup] = useState({
    groupName: '',
    displayName: '',
    description: '',
    year: new Date().getFullYear().toString(),
  });

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchGroups(selectedYear);
    }
  }, [selectedYear]);

  const fetchYears = async () => {
    try {
      const response = await fetch('/api/albums');
      const data = await response.json();
      setYears(data.years || []);
      if (data.years && data.years.length > 0) {
        setSelectedYear(data.years[0]);
      }
    } catch (error) {
      console.error('Error fetching years:', error);
    }
  };

  const fetchGroups = async (year: string) => {
    try {
      const response = await fetch(`/api/groups?year=${year}`);
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newGroup),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Group created successfully!');
        setNewGroup({
          groupName: '',
          displayName: '',
          description: '',
          year: new Date().getFullYear().toString(),
        });
        setShowCreateForm(false);
        if (selectedYear === newGroup.year) {
          fetchGroups(selectedYear);
        }
      } else {
        setMessage(data.error || 'Failed to create group');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = (group: GroupMetadata) => {
    setEditingGroup({ ...group });
  };

  const handleSaveEdit = async () => {
    if (!editingGroup) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/groups/${selectedYear}/${editingGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: editingGroup.displayName,
          description: editingGroup.description,
          nestedAlbums: editingGroup.nestedAlbums,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Group updated successfully!');
        setEditingGroup(null);
        fetchGroups(selectedYear);
      } else {
        setMessage(data.error || 'Failed to update group');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/groups/${selectedYear}/${groupId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Group deleted successfully!');
        fetchGroups(selectedYear);
      } else {
        setMessage(data.error || 'Failed to delete group');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-slate-100">Group Management</h1>
            <Link
              href="/admin"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              ← Back to Albums
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {message && (
          <div className={`fixed top-0 left-0 right-0 z-50 shadow-lg ${
            message.toLowerCase().includes('successfully') 
              ? 'bg-green-600 text-white border-b border-green-500' 
              : 'bg-red-900 text-red-100 border-b border-red-700'
          }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className={`h-5 w-5 mr-2 ${message.toLowerCase().includes('successfully') ? 'text-green-200' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    {message.toLowerCase().includes('successfully') ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    )}
                  </svg>
                  <span>{message}</span>
                </div>
                <button
                  onClick={() => setMessage('')}
                  className="ml-4 text-white hover:text-gray-200"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`bg-slate-700 shadow rounded-lg p-6 ${message ? 'mt-20' : ''}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-100">Album Groups</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create New Group
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateGroup} className="mb-6 p-4 border border-slate-600 rounded-md bg-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Group Name (URL-friendly)
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroup.groupName}
                    onChange={(e) => setNewGroup({ ...newGroup, groupName: e.target.value })}
                    placeholder="e.g., 2025-01-albuquerque"
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    required
                    value={newGroup.year}
                    onChange={(e) => setNewGroup({ ...newGroup, year: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroup.displayName}
                    onChange={(e) => setNewGroup({ ...newGroup, displayName: e.target.value })}
                    placeholder="e.g., Albuquerque Trip"
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    placeholder="Hot air balloon festival and local exploration"
                    className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-600 rounded-md hover:bg-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          )}

          <div className="mb-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
            >
              <option value="">Select Year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="border border-slate-600 rounded-md p-4 bg-slate-800">
                {editingGroup && editingGroup.id === group.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editingGroup.displayName}
                        onChange={(e) => setEditingGroup({ ...editingGroup, displayName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editingGroup.description}
                        onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingGroup(null)}
                        className="px-3 py-1 text-sm text-slate-300 bg-slate-600 rounded hover:bg-slate-500"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg text-slate-100">
                          {group.displayName}
                        </h3>
                        <p className="text-slate-400 text-sm">ID: {group.id}</p>
                        <p className="text-slate-300">{group.description}</p>
                        <p className="text-sm text-slate-400">
                          Created: {new Date(group.created).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-slate-400">
                          Albums: {group.albumCount}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                          disabled={group.albumCount > 0}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {group.albumCount > 0 && (
                      <p className="text-yellow-400 text-sm mt-2">
                        Cannot delete: Contains {group.albumCount} album(s). Move or delete albums first.
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}