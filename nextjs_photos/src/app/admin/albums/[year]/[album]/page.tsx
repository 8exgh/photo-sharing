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
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

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

  const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<number | null>(null);
  const [photoText, setPhotoText] = useState('');
  const [videoText, setVideoText] = useState('');
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);

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

  const handleDeletePhoto = async (filename: string) => {
    if (!confirm(`Are you sure you want to permanently delete this photo? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingPhoto(filename);
    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}/photos/${filename}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Photo deleted successfully');
        fetchAlbum(); // Refresh the album data
      } else {
        setMessage(data.error || 'Failed to delete photo');
      }
    } catch (error) {
      setMessage('Network error while deleting photo');
    } finally {
      setDeletingPhoto(null);
    }
  };

  const handleUploadPhotos = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      setUploadingPhotos(true);
      let successCount = 0;
      let errorCount = 0;
      
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch(`/api/albums/${params.year}/${params.album}/upload`, {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        }
        
        if (errorCount === 0) {
          setMessage(`Successfully uploaded ${successCount} photo(s)`);
        } else {
          setMessage(`Uploaded ${successCount} photo(s), ${errorCount} failed`);
        }
        
        // Refresh the album data to show new photos
        fetchAlbum();
      } catch (error) {
        setMessage('Error uploading photos');
      } finally {
        setUploadingPhotos(false);
      }
    };
    
    input.click();
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
            <div>
              <button
                onClick={handleUploadPhotos}
                disabled={uploadingPhotos}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>{uploadingPhotos ? 'Uploading...' : 'Upload Photos'}</span>
              </button>
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
        {album.metadata.photos.length > 0 ? (
          <div className={`mb-8 ${message ? 'mt-20' : ''}`}>
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Photos ({album.metadata.photos.length})</h2>
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
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-100">{photo.title}</h3>
                      <button
                        onClick={() => handleDeletePhoto(photo.filename)}
                        disabled={deletingPhoto === photo.filename}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        title="Delete photo"
                      >
                        {deletingPhoto === photo.filename ? (
                          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
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
        ) : (
          <div className={`mb-8 ${message ? 'mt-20' : ''}`}>
            <div className="bg-slate-700 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-100 mb-2">No photos yet</h3>
              <p className="text-slate-400 mb-4">Upload photos to get started</p>
              <button
                onClick={handleUploadPhotos}
                disabled={uploadingPhotos}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>{uploadingPhotos ? 'Uploading...' : 'Upload Photos'}</span>
              </button>
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