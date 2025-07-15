'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Album {
  name: string;
  path: string;
  metadata: {
    name: string;
    location: string;
    description: string;
    created: string;
  } | null;
}

export default function AdminDashboard() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAccessKeyForm, setShowAccessKeyForm] = useState(false);
  const [accessKeys, setAccessKeys] = useState<Array<{key: string; created: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({});
  const router = useRouter();

  const [newAlbum, setNewAlbum] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    location: '',
    description: '',
  });

  useEffect(() => {
    fetchYears();
    fetchAccessKeys();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchAlbums(selectedYear);
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

  const fetchAlbums = async (year: string) => {
    try {
      const response = await fetch(`/api/albums?year=${year}`);
      const data = await response.json();
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Error fetching albums:', error);
    }
  };

  const fetchAccessKeys = async () => {
    try {
      const response = await fetch('/api/access-keys');
      const data = await response.json();
      setAccessKeys(data.keys || []);
    } catch (error) {
      console.error('Error fetching access keys:', error);
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
        });
        setShowCreateForm(false);
        fetchYears();
        if (selectedYear === newAlbum.year) {
          fetchAlbums(selectedYear);
        }
      } else {
        setMessage(data.error || 'Failed to create album');
      }
    } catch (error) {
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
        setMessage(`Access key created: ${data.key}`);
        fetchAccessKeys();
      } else {
        setMessage(data.error || 'Failed to create access key');
      }
    } catch (error) {
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
      } catch (error) {
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-md ${
            message.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Albums Section */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Albums</h2>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Create New Album
                </button>
              </div>

              {showCreateForm && (
                <form onSubmit={handleCreateAlbum} className="mb-6 p-4 border rounded-md">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Album Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newAlbum.name}
                        onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Year
                      </label>
                      <input
                        type="number"
                        required
                        value={newAlbum.year}
                        onChange={(e) => setNewAlbum({ ...newAlbum, year: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={newAlbum.location}
                        onChange={(e) => setNewAlbum({ ...newAlbum, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newAlbum.description}
                        onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4 space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
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

              <div className="mb-4">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {albums.map((album) => (
                  <div key={album.path} className="border rounded-md p-4">
                    <h3 className="font-semibold text-lg">
                      {album.metadata?.name || album.name}
                    </h3>
                    <p className="text-gray-600">{album.metadata?.location}</p>
                    <p className="text-gray-600">{album.metadata?.description}</p>
                    <p className="text-sm text-gray-500">
                      Created: {album.metadata?.created ? new Date(album.metadata.created).toLocaleDateString() : 'Unknown'}
                    </p>
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => handleUploadPhotos(selectedYear, album.name)}
                        disabled={uploadingFiles[`${selectedYear}/${album.name}`]}
                        className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                      >
                        {uploadingFiles[`${selectedYear}/${album.name}`] ? 'Uploading...' : 'Upload Photos'}
                      </button>
                      <button
                        onClick={() => handleAddVideo(selectedYear, album.name)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Add Video
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Access Keys Section */}
          <div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Access Keys</h2>
                <button
                  onClick={handleCreateAccessKey}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Generate Key
                </button>
              </div>

              <div className="space-y-4">
                {accessKeys.map((key, index) => (
                  <div key={index} className="border rounded-md p-4">
                    <div className="font-mono text-sm break-all">{key.key}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Created: {new Date(key.created).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-blue-600 mt-2">
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}