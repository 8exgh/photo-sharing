'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface AlbumData {
  metadata: {
    name: string;
    location: string;
    description: string;
    text?: string;
    created: string;
    photos: Array<{
      filename: string;
      title: string;
      uploadDate: string;
      description: string;
      text?: string;
    }>;
    videos: Array<{
      url: string;
      title: string;
      addedDate: string;
      text?: string;
    }>;
  };
  photos: string[];
  albumPath: string;
}

export default function AlbumContentManager() {
  const params = useParams();
  const router = useRouter();
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Auto-dismiss message after 10 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<number | null>(null);
  const [photoText, setPhotoText] = useState('');
  const [videoText, setVideoText] = useState('');

  useEffect(() => {
    fetchAlbum();
  }, [params.year, params.album]);

  const fetchAlbum = async () => {
    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}`);
      const data = await response.json();
      
      if (response.ok) {
        setAlbum(data);
      } else {
        setMessage(data.error || 'Failed to load album');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPhotoText = (filename: string, currentText: string) => {
    setEditingPhoto(filename);
    setPhotoText(currentText || '');
  };

  const handleSavePhotoText = async (filename: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}/photos/${filename}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: photoText }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Photo text updated successfully!');
        setEditingPhoto(null);
        fetchAlbum();
      } else {
        setMessage(data.error || 'Failed to update photo text');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditVideoText = (index: number, currentText: string) => {
    setEditingVideo(index);
    setVideoText(currentText || '');
  };

  const handleSaveVideoText = async (index: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}/videos/${index}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: videoText }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Video text updated successfully!');
        setEditingVideo(null);
        fetchAlbum();
      } else {
        setMessage(data.error || 'Failed to update video text');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPhoto(null);
    setEditingVideo(null);
    setPhotoText('');
    setVideoText('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="text-lg text-slate-100">Loading album...</div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="text-red-400">{message || 'Album not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/admin"
                className="text-blue-400 hover:text-blue-300 mb-4 inline-flex items-center"
              >
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Admin
              </Link>
              <h1 className="text-3xl font-bold text-slate-100">
                Manage Content: {album.metadata.name}
              </h1>
              <p className="text-slate-300 mt-2">
                Edit text for photos and videos in this album
              </p>
            </div>
          </div>
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

        {/* Photos Section */}
        {album.metadata.photos.length > 0 && (
          <div className={`mb-8 ${message ? 'mt-20' : ''}`}>
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Photos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {album.metadata.photos.map((photo, index) => (
                <div key={photo.filename} className="bg-slate-700 rounded-lg shadow-md overflow-hidden">
                  <div className="aspect-video bg-slate-600 relative">
                    <Image
                      src={`/api/thumbnails/${album.albumPath}/${photo.filename}`}
                      alt={photo.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-100 mb-2">{photo.title}</h3>
                    <p className="text-sm text-slate-400 mb-2">
                      {new Date(photo.uploadDate).toLocaleDateString()}
                    </p>
                    
                    {editingPhoto === photo.filename ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">
                          Photo Text
                        </label>
                        <textarea
                          value={photoText}
                          onChange={(e) => setPhotoText(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100 resize-vertical"
                          rows={4}
                          placeholder="Enter photo description..."
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-sm text-slate-300 bg-slate-600 rounded hover:bg-slate-500"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSavePhotoText(photo.filename)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {photo.text && (
                          <div className="mb-2 p-2 border border-slate-600 rounded bg-slate-800">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">
                              {photo.text}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleEditPhotoText(photo.filename, photo.text || '')}
                          className="text-yellow-400 hover:text-yellow-300 text-sm"
                        >
                          {photo.text ? 'Edit Text' : 'Add Text'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Videos Section */}
        {album.metadata.videos.length > 0 && (
          <div className={`${message ? (album.metadata.photos.length === 0 ? 'mt-20' : '') : ''}`}>
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {album.metadata.videos.map((video, index) => (
                <div key={index} className="bg-slate-700 rounded-lg shadow-md p-4">
                  <h3 className="font-semibold text-slate-100 mb-2">{video.title}</h3>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 mb-2 inline-block"
                  >
                    Watch Video →
                  </a>
                  <p className="text-sm text-slate-400 mb-4">
                    Added: {new Date(video.addedDate).toLocaleDateString()}
                  </p>
                  
                  {editingVideo === index ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">
                        Video Text
                      </label>
                      <textarea
                        value={videoText}
                        onChange={(e) => setVideoText(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-slate-100 resize-vertical"
                        rows={4}
                        placeholder="Enter video description..."
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm text-slate-300 bg-slate-600 rounded hover:bg-slate-500"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveVideoText(index)}
                          disabled={loading}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {video.text && (
                        <div className="mb-2 p-2 border border-slate-600 rounded bg-slate-800">
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">
                            {video.text}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => handleEditVideoText(index, video.text || '')}
                        className="text-yellow-400 hover:text-yellow-300 text-sm"
                      >
                        {video.text ? 'Edit Text' : 'Add Text'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {album.metadata.photos.length === 0 && album.metadata.videos.length === 0 && (
          <div className={`text-center py-12 ${message ? 'mt-20' : ''}`}>
            <div className="text-slate-400">No photos or videos in this album yet</div>
          </div>
        )}
      </div>
    </div>
  );
}