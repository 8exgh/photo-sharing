'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface AlbumMetadata {
  name: string;
  location: string;
  description: string;
  text?: string;
  created: string;
}

export default function EditAlbum() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [albumData, setAlbumData] = useState<AlbumMetadata>({
    name: '',
    location: '',
    description: '',
    text: '',
    created: '',
  });

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

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        const response = await fetch(`/api/albums/${params.year}/${params.album}`);
        const data = await response.json();
        
        if (response.ok) {
          setAlbumData({
            name: data.metadata.name || '',
            location: data.metadata.location || '',
            description: data.metadata.description || '',
            text: data.metadata.text || '',
            created: data.metadata.created || '',
          });
        } else {
          setMessage(data.error || 'Failed to load album');
        }
      } catch (error) {
        setMessage('Network error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAlbumData();
  }, [params.year, params.album]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: albumData.name,
          location: albumData.location,
          description: albumData.description,
          text: albumData.text,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Album updated successfully!');
        setTimeout(() => {
          router.push('/admin');
        }, 2000);
      } else {
        setMessage(data.error || 'Failed to update album');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-slate-100">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1"
          >
            <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M15 19l-7-7 7-7"></path>
            </svg>
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <div className="bg-slate-700 shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-slate-100 mb-6">
            Edit Album: {params.album}
          </h1>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.toLowerCase().includes('successfully') 
                ? 'bg-green-900 text-green-100 border border-green-700' 
                : 'bg-red-900 text-red-100 border border-red-700'
            }`}>
              <div className="flex items-center">
                <svg className={`h-5 w-5 mr-2 ${
                  message.toLowerCase().includes('successfully') 
                    ? 'text-green-200' 
                    : 'text-red-400'
                }`} viewBox="0 0 20 20" fill="currentColor">
                  {message.toLowerCase().includes('successfully') ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  )}
                </svg>
                <span>{message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Album Name
              </label>
              <input
                type="text"
                required
                value={albumData.name}
                onChange={(e) => setAlbumData({ ...albumData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Location
              </label>
              <input
                type="text"
                value={albumData.location}
                onChange={(e) => setAlbumData({ ...albumData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <input
                type="text"
                value={albumData.description}
                onChange={(e) => setAlbumData({ ...albumData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Album Text
              </label>
              <textarea
                value={albumData.text}
                onChange={(e) => setAlbumData({ ...albumData, text: e.target.value })}
                className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100 resize-vertical"
                rows={6}
                placeholder="Enter multi-line album text..."
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 text-slate-300 bg-slate-600 rounded-md hover:bg-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-600">
            <p className="text-sm text-slate-400">
              Created: {albumData.created ? new Date(albumData.created).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}