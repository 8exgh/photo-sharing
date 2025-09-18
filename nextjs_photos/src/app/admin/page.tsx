'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GroupMetadata } from '@/types';

interface Album {
  name: string;
  path: string;
  metadata: {
    name: string;
    location: string;
    description: string;
    text?: string;
    created: string;
  } | null;
  groupId?: string;
  isNested?: boolean;
}

interface BuildInfo {
  gitHash: string;
  gitHashShort: string;
  gitBranch: string;
  buildNumber: string;
  buildTime: string;
  nodeEnv: string;
}

export default function AdminDashboard() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [groups, setGroups] = useState<GroupMetadata[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [accessKeys, setAccessKeys] = useState<Array<{key: string; created: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);

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
  const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({});
  const [editingAlbumText, setEditingAlbumText] = useState<string | null>(null);
  const [albumText, setAlbumText] = useState<string>('');
  const router = useRouter();

  const [newAlbum, setNewAlbum] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    location: '',
    description: '',
    groupId: '',
    datePrefix: '',
  });

  useEffect(() => {
    fetchYears();
    fetchAccessKeys();
    fetchBuildInfo();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchAlbums(selectedYear);
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
    } catch (_error) {
      console.error('Error fetching years:', _error);
    }
  };

  const fetchAlbums = async (year: string) => {
    try {
      const response = await fetch(`/api/albums?year=${year}`);
      const data = await response.json();
      setAlbums(data.albums || []);
    } catch (_error) {
      console.error('Error fetching albums:', _error);
    }
  };

  const fetchAccessKeys = async () => {
    try {
      const response = await fetch('/api/access-keys');
      const data = await response.json();
      setAccessKeys(data.keys || []);
    } catch (_error) {
      console.error('Error fetching access keys:', _error);
    }
  };

  const fetchBuildInfo = async () => {
    try {
      const response = await fetch('/api/build-info');
      const data = await response.json();
      setBuildInfo(data);
    } catch (_error) {
      console.error('Error fetching build info:', _error);
    }
  };

  const fetchGroups = async (year: string) => {
    try {
      const response = await fetch(`/api/groups?year=${year}`);
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (_error) {
      console.error('Error fetching groups:', _error);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAlbum),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Album created successfully!');
        setNewAlbum({
          name: '',
          year: new Date().getFullYear().toString(),
          location: '',
          description: '',
          groupId: '',
          datePrefix: '',
        });
        setShowCreateForm(false);
        fetchYears();
        if (selectedYear === newAlbum.year) {
          fetchAlbums(selectedYear);
        }
      } else {
        setMessage(data.error || 'Failed to create album');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccessKey = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/access-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Access key created successfully: ${data.key}`);
        fetchAccessKeys();
      } else {
        setMessage(data.error || 'Failed to create access key');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccessKey = async (keyToDelete: string) => {
    const confirmed = confirm('Are you sure you want to delete this access key? This action cannot be undone.');
    if (!confirmed) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/access-keys', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: keyToDelete }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Access key deleted successfully');
        fetchAccessKeys();
      } else {
        setMessage(data.error || 'Failed to delete access key');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhotos = async (year: string, albumName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      const albumKey = `${year}/${albumName}`;
      setUploadingFiles(prev => ({ ...prev, [albumKey]: true }));
      
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch(`/api/albums/${year}/${albumName}/upload`, {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
        }
        
        setMessage(`Successfully uploaded ${files.length} photo(s)`);
        if (selectedYear === year) {
          fetchAlbums(selectedYear);
        }
      } catch (_error) {
        setMessage('Error uploading photos');
      } finally {
        setUploadingFiles(prev => ({ ...prev, [albumKey]: false }));
      }
    };
    
    input.click();
  };

  const handleAddVideo = async (year: string, albumName: string) => {
    const url = prompt('Enter video URL:');
    const title = prompt('Enter video title:');
    
    if (!url || !title) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/albums/${year}/${albumName}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, title }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Video link added successfully!');
        if (selectedYear === year) {
          fetchAlbums(selectedYear);
        }
      } else {
        setMessage(data.error || 'Failed to add video');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAlbumText = async (year: string, albumName: string, currentText: string) => {
    setEditingAlbumText(`${year}/${albumName}`);
    setAlbumText(currentText || '');
  };

  const handleSaveAlbumText = async (year: string, albumName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/albums/${year}/${albumName}/text`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: albumText }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Album text updated successfully!');
        setEditingAlbumText(null);
        if (selectedYear === year) {
          fetchAlbums(selectedYear);
        }
      } else {
        setMessage(data.error || 'Failed to update album text');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditAlbumText = () => {
    setEditingAlbumText(null);
    setAlbumText('');
  };

  const handleReorderAlbum = async (album: Album, direction: 'up' | 'down') => {
    setLoading(true);
    try {
      const response = await fetch('/api/albums/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: selectedYear,
          albumPath: album.path,
          direction,
          groupId: album.groupId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Album moved ${direction} successfully`);
        fetchAlbums(selectedYear);
      } else {
        setMessage(data.error || 'Failed to reorder album');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveAlbum = async (albumPath: string, targetGroupId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/albums/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          albumPath,
          year: selectedYear,
          groupId: targetGroupId || null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Album moved successfully!');
        fetchAlbums(selectedYear);
        fetchGroups(selectedYear);
      } else {
        setMessage(data.error || 'Failed to move album');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (_error) {
      console.error('Logout error:', _error);
    }
  };

  // Filter albums based on selected group
  const filteredAlbums = albums.filter(album => {
    if (selectedGroup === 'all') return true;
    if (selectedGroup === 'ungrouped') return !album.groupId;
    return album.groupId === selectedGroup;
  });

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-slate-100">Admin Dashboard</h1>
            <Link
              href="/admin/groups"
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
            >
              Manage Groups
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
            message.toLowerCase().includes('successfully') ? 'bg-green-600 text-white border-b border-green-500' : 'bg-red-900 text-red-100 border-b border-red-700'
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

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${message ? 'pt-20' : ''}`}>
          {/* Albums Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-700 shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-100">Albums</h2>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Create New Album
                </button>
              </div>

              {showCreateForm && (
                <form onSubmit={handleCreateAlbum} className="mb-6 p-4 border border-slate-600 rounded-md bg-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Album Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newAlbum.name}
                        onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })}
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
                        value={newAlbum.year}
                        onChange={(e) => setNewAlbum({ ...newAlbum, year: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Date Prefix (optional)
                      </label>
                      <input
                        type="text"
                        value={newAlbum.datePrefix}
                        onChange={(e) => setNewAlbum({ ...newAlbum, datePrefix: e.target.value })}
                        placeholder="e.g., 2025-05-31"
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Group (optional)
                      </label>
                      <select
                        value={newAlbum.groupId}
                        onChange={(e) => setNewAlbum({ ...newAlbum, groupId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                      >
                        <option value="">No Group</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={newAlbum.location}
                        onChange={(e) => setNewAlbum({ ...newAlbum, location: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newAlbum.description}
                        onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })}
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
                      {loading ? 'Creating...' : 'Create Album'}
                    </button>
                  </div>
                </form>
              )}

              <div className="mb-4 flex space-x-4">
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
                
                {selectedYear && (
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                  >
                    <option value="all">All Groups</option>
                    <option value="ungrouped">Ungrouped Albums</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-4">
                {filteredAlbums.map((album, index) => (
                  <div key={album.path} className={`border border-slate-600 rounded-md p-4 bg-slate-800 ${album.isNested ? 'ml-8 border-l-4 border-l-blue-500' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-2">
                        {/* Up/Down controls */}
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleReorderAlbum(album, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleReorderAlbum(album, 'down')}
                            disabled={index === filteredAlbums.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-slate-100">
                            {album.metadata?.name || album.name}
                            {album.isNested && <span className="ml-2 text-blue-400 text-sm">(nested)</span>}
                          </h3>
                          <p className="text-slate-300">{album.metadata?.location}</p>
                          <p className="text-slate-300">{album.metadata?.description}</p>
                          <p className="text-sm text-slate-400">
                            Created: {album.metadata?.created ? new Date(album.metadata.created).toLocaleDateString() : 'Unknown'}
                          </p>
                          {album.groupId && (
                            <p className="text-sm text-purple-400">
                              Group: {groups.find(g => g.id === album.groupId)?.displayName || album.groupId}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <select
                          onChange={(e) => handleMoveAlbum(album.path, e.target.value)}
                          className="px-2 py-1 text-sm border border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
                          defaultValue={album.groupId || ''}
                        >
                          <option value="">Move to Group...</option>
                          <option value="">No Group</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Album Text Section */}
                    {editingAlbumText === `${selectedYear}/${album.name}` ? (
                      <div className="mt-4 p-3 border border-slate-600 rounded-md bg-slate-700">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Album Text
                        </label>
                        <textarea
                          value={albumText}
                          onChange={(e) => setAlbumText(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100 resize-vertical"
                          rows={6}
                          placeholder="Enter multi-line album text..."
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <button
                            onClick={handleCancelEditAlbumText}
                            className="px-3 py-1 text-sm text-slate-300 bg-slate-600 rounded hover:bg-slate-500"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveAlbumText(selectedYear, album.name)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        {album.metadata?.text && (
                          <div className="mb-2 p-2 border border-slate-600 rounded bg-slate-800">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">
                              {album.metadata.text}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => handleUploadPhotos(selectedYear, album.name)}
                        disabled={uploadingFiles[`${selectedYear}/${album.name}`]}
                        className="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
                      >
                        {uploadingFiles[`${selectedYear}/${album.name}`] ? 'Uploading...' : 'Upload Photos'}
                      </button>
                      <button
                        onClick={() => handleAddVideo(selectedYear, album.name)}
                        className="text-emerald-400 hover:text-emerald-300 text-sm"
                      >
                        Add Video
                      </button>
                      <button
                        onClick={() => handleEditAlbumText(selectedYear, album.name, album.metadata?.text || '')}
                        className="text-yellow-400 hover:text-yellow-300 text-sm"
                      >
                        Edit Text
                      </button>
                      <Link
                        href={`/admin/albums/${selectedYear}/${album.name}/edit`}
                        className="text-green-400 hover:text-green-300 text-sm"
                      >
                        Edit Album Details
                      </Link>
                      <Link
                        href={`/admin/albums/${selectedYear}/${album.name}`}
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Manage Content
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Access Keys Section */}
          <div>
            <div className="bg-slate-700 shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-100">Access Keys</h2>
                <button
                  onClick={handleCreateAccessKey}
                  disabled={loading}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  Generate Key
                </button>
              </div>

              <div className="space-y-4">
                {accessKeys.map((key, index) => (
                  <div key={index} className="border border-slate-600 rounded-md p-4 bg-slate-800">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-mono text-sm break-all text-slate-200">{key.key}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          Created: {new Date(key.created).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-blue-400 mt-2">
                          <a
                            href={`/albums?key=${key.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            /albums?key={key.key}
                          </a>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAccessKey(key.key)}
                        disabled={loading}
                        className="ml-2 p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded disabled:opacity-50"
                        title="Delete access key"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Build Info Footer */}
        {buildInfo && (
          <div className="mt-8 py-4 border-t border-slate-600">
            <div className="text-center text-xs text-slate-500">
              <span className="inline-flex items-center space-x-3">
                <span>
                  <span className="text-slate-600">Build:</span>
                  <span className="ml-1 font-mono text-slate-400">
                    {buildInfo.gitHashShort}
                  </span>
                </span>
                
                {buildInfo.buildNumber !== 'local' && (
                  <span className="text-slate-600">•</span>
                )}
                
                {buildInfo.buildNumber !== 'local' && (
                  <span>
                    <span className="text-slate-600">Run:</span>
                    <span className="ml-1 font-mono text-slate-400">
                      #{buildInfo.buildNumber}
                    </span>
                  </span>
                )}
                
                {buildInfo.gitBranch !== 'unknown' && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>
                      <span className="text-slate-600">Branch:</span>
                      <span className="ml-1 font-mono text-slate-400">
                        {buildInfo.gitBranch}
                      </span>
                    </span>
                  </>
                )}
                
                <span className="text-slate-600">•</span>
                
                <span>
                  <span className="text-slate-600">Built:</span>
                  <span className="ml-1 text-slate-400">
                    {buildInfo.buildTime !== 'unknown' 
                      ? new Date(buildInfo.buildTime).toLocaleString()
                      : 'unknown'}
                  </span>
                </span>
                
                {buildInfo.nodeEnv === 'development' && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-500 font-medium">DEV MODE</span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}