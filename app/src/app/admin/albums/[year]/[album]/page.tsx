'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface AlbumData {
  albumId: string;
  metadata: {
    name: string;
    location: string;
    description: string;
    text?: string;
    created: string;
    photos: Array<{
      id: string;
      originalFilename: string;
      title: string;
      text: string;
      width: number;
      height: number;
      fileSize: number;
      uploadDate: string;
    }>;
    videos: Array<{
      id: string;
      url: string;
      title: string;
      text: string;
      addedDate: string;
    }>;
  };
  groupId?: string;
  firstPhotoId?: string;
}

// Helper function to format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Helper function to extract YouTube video ID from URL
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Helper function to check if URL is a YouTube link
function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

export default function AlbumContentManager() {
  const params = useParams();
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
  const [editingVideo, setEditingVideo] = useState<string | null>(null);
  const [photoText, setPhotoText] = useState('');
  const [videoText, setVideoText] = useState('');
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [rotatingPhoto, setRotatingPhoto] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [editingVideoTitle, setEditingVideoTitle] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [scrollPosition, setScrollPosition] = useState<number | null>(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [photoToMove, setPhotoToMove] = useState<{id: string; title: string} | null>(null);
  const [availableAlbums, setAvailableAlbums] = useState<Array<{urlName: string; year: string; displayName: string}>>([]);
  const [selectedTargetAlbum, setSelectedTargetAlbum] = useState<{year: string; album: string} | null>(null);
  const [movingPhoto, setMovingPhoto] = useState(false);

  const fetchAlbum = useCallback(async () => {
    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}`);
      const data = await response.json();

      if (response.ok) {
        setAlbum(data);
        setAlbumTitle(data.metadata.name || '');
      } else {
        setMessage(data.error || 'Failed to load album');
      }
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  }, [params.year, params.album]);

  useEffect(() => {
    fetchAlbum();
  }, [fetchAlbum]);

  // Restore scroll position after data loads
  useEffect(() => {
    if (scrollPosition !== null && !loading) {
      window.scrollTo(0, scrollPosition);
      setScrollPosition(null);
    }
  }, [loading, scrollPosition]);

  const handleEditPhotoText = (photoId: string, currentText: string) => {
    setEditingPhoto(photoId);
    setPhotoText(currentText || '');
  };

  const handleSavePhotoText = async (photoId: string) => {
    // Capture current scroll position before saving
    setScrollPosition(window.scrollY);
    setLoading(true);
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
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
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditVideoText = (videoId: string, currentText: string) => {
    setEditingVideo(videoId);
    setVideoText(currentText || '');
  };

  const handleSaveVideoText = async (videoId: string) => {
    // Capture current scroll position before saving
    setScrollPosition(window.scrollY);
    setLoading(true);
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
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
    } catch (_error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVideoTitle = async (videoId: string) => {
    if (!album) return;

    const video = album.metadata.videos.find(v => v.id === videoId);
    if (!video) return;

    if (videoTitle.trim() === video.title) {
      setEditingVideoTitle(null);
      return;
    }

    // Capture current scroll position before saving
    setScrollPosition(window.scrollY);
    setLoading(true);
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: videoTitle.trim() }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Video title updated successfully!');
        setEditingVideoTitle(null);
        fetchAlbum();
      } else {
        setMessage(data.error || 'Failed to update video title');
        setVideoTitle(video.title); // Reset to original
      }
    } catch (_error) {
      setMessage('Network error while updating title');
      if (album) {
        const v = album.metadata.videos.find(v => v.id === videoId);
        if (v) setVideoTitle(v.title); // Reset to original
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditVideoTitle = () => {
    setEditingVideoTitle(null);
    setVideoTitle('');
  };

  const handleCancelEdit = () => {
    setEditingPhoto(null);
    setEditingVideo(null);
    setPhotoText('');
    setVideoText('');
  };

  const handleSaveAlbumTitle = async () => {
    if (albumTitle.trim() === album?.metadata.name) {
      setEditingTitle(false);
      return;
    }

    // Capture current scroll position before saving
    setScrollPosition(window.scrollY);
    setLoading(true);
    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: albumTitle.trim(),
          location: album?.metadata.location,
          description: album?.metadata.description,
          text: album?.metadata.text,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Album title updated successfully');
        setEditingTitle(false);
        fetchAlbum(); // Refresh the album data
      } else {
        setMessage(data.error || 'Failed to update album title');
        setAlbumTitle(album?.metadata.name || ''); // Reset to original
      }
    } catch (_error) {
      setMessage('Network error while updating title');
      setAlbumTitle(album?.metadata.name || ''); // Reset to original
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditTitle = () => {
    setEditingTitle(false);
    setAlbumTitle(album?.metadata.name || '');
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm(`Are you sure you want to permanently delete this photo? This action cannot be undone.`)) {
      return;
    }

    setDeletingPhoto(photoId);
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Photo deleted successfully');
        fetchAlbum(); // Refresh the album data
      } else {
        setMessage(data.error || 'Failed to delete photo');
      }
    } catch (_error) {
      setMessage('Network error while deleting photo');
    } finally {
      setDeletingPhoto(null);
    }
  };

  const handleRotatePhoto = async (photoId: string) => {
    // Capture current scroll position before rotating
    setScrollPosition(window.scrollY);
    setRotatingPhoto(photoId);
    try {
      const response = await fetch(`/api/photos/${photoId}/rotate`, {
        method: 'POST',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Photo rotated successfully');
        // Force refresh by adding timestamp to image URLs
        setImageRefreshKey(Date.now());
        fetchAlbum();
      } else {
        setMessage(data.error || 'Failed to rotate photo');
      }
    } catch (_error) {
      setMessage('Network error while rotating photo');
    } finally {
      setRotatingPhoto(null);
    }
  };

  const handleOpenMoveModal = async (photoId: string, title: string) => {
    setPhotoToMove({ id: photoId, title });
    setShowMoveModal(true);
    setSelectedTargetAlbum(null);

    // Fetch all available albums
    try {
      const response = await fetch('/api/albums');
      const data = await response.json();
      const allAlbums: Array<{urlName: string; year: string; displayName: string}> = [];

      if (data.years) {
        for (const year of data.years) {
          const yearResponse = await fetch(`/api/albums?year=${year}`);
          const yearData = await yearResponse.json();

          if (yearData.albums) {
            yearData.albums.forEach((album: { albumId: string; name: string; urlName: string; metadata?: { name?: string } }) => {
              // Don't include the current album
              if (!(year === params.year && album.urlName === params.album)) {
                allAlbums.push({
                  urlName: album.urlName,
                  year: year,
                  displayName: `${year} - ${album.metadata?.name || album.name}`,
                });
              }
            });
          }
        }
      }

      setAvailableAlbums(allAlbums);
    } catch (error) {
      console.error('Error fetching albums:', error);
      setMessage('Failed to load albums');
    }
  };

  const handleMovePhoto = async () => {
    if (!photoToMove || !selectedTargetAlbum) return;

    setMovingPhoto(true);
    try {
      const response = await fetch(
        `/api/photos/${photoToMove.id}/move`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetYear: selectedTargetAlbum.year,
            targetAlbum: selectedTargetAlbum.album,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMessage(`Photo moved successfully to ${selectedTargetAlbum.year} - ${selectedTargetAlbum.album}`);
        setShowMoveModal(false);
        setPhotoToMove(null);
        fetchAlbum(); // Refresh current album
      } else {
        setMessage(data.error || 'Failed to move photo');
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
      setMessage('Network error while moving photo');
    } finally {
      setMovingPhoto(false);
    }
  };

  const handleCloseMoveModal = () => {
    setShowMoveModal(false);
    setPhotoToMove(null);
    setSelectedTargetAlbum(null);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm(`Are you sure you want to remove this video? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/albums/${params.year}/${params.album}/videos?videoId=${videoId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Video deleted successfully');
        fetchAlbum();
      } else {
        setMessage(data.error || 'Failed to delete video');
      }
    } catch (_error) {
      setMessage('Network error while deleting video');
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
      } catch (_error) {
        setMessage('Error uploading photos');
      } finally {
        setUploadingPhotos(false);
      }
    };

    input.click();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800">
        <div className="text-lg text-slate-100">Loading album...</div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800">
        <div className="text-red-400">{message || 'Album not found'}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-800 py-8">
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
              <div className="flex items-center space-x-2">
                {editingTitle ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={albumTitle}
                      onChange={(e) => setAlbumTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAlbumTitle();
                        if (e.key === 'Escape') handleCancelEditTitle();
                      }}
                      className="text-3xl font-bold bg-slate-700 text-slate-100 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveAlbumTitle}
                      disabled={loading}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                      title="Save"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelEditTitle}
                      className="text-slate-400 hover:text-slate-300"
                      title="Cancel"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 group">
                    <h1 className="text-3xl font-bold text-slate-100">
                      Manage Content: {album.metadata.name}
                    </h1>
                    <button
                      onClick={() => {
                        setEditingTitle(true);
                        setAlbumTitle(album.metadata.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-300"
                      title="Edit title"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-100">Photos ({album.metadata.photos.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {album.metadata.photos.map((photo) => (
                <div key={photo.id} className="bg-slate-700 rounded-lg shadow-md overflow-hidden">
                  <div className="aspect-video bg-slate-600 relative">
                    <Image
                      src={`/api/thumbnails/${photo.id}?t=${imageRefreshKey}`}
                      alt={photo.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-100">{photo.title}</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleOpenMoveModal(photo.id, photo.title)}
                          className="text-green-400 hover:text-green-300"
                          title="Move to another album"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRotatePhoto(photo.id)}
                          disabled={rotatingPhoto === photo.id}
                          className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                          title="Rotate photo clockwise"
                        >
                          {rotatingPhoto === photo.id ? (
                            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          disabled={deletingPhoto === photo.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          title="Delete photo"
                        >
                          {deletingPhoto === photo.id ? (
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
                    </div>
                    <div className="text-sm text-slate-400 mb-2 space-y-1">
                      <p>{new Date(photo.uploadDate).toLocaleDateString()}</p>
                      <p className="text-xs">
                        {photo.width && photo.height ? (
                          <>
                            <span className="inline-block mr-3">
                              {photo.width} × {photo.height}px
                            </span>
                            <span className="inline-block">
                              {formatFileSize(photo.fileSize)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">Metadata not available</span>
                        )}
                      </p>
                    </div>

                    {editingPhoto === photo.id ? (
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
                            onClick={() => handleSavePhotoText(photo.id)}
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
                          onClick={() => handleEditPhotoText(photo.id, photo.text || '')}
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
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Videos ({album.metadata.videos.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {album.metadata.videos.map((video) => {
                const isYouTube = isYouTubeUrl(video.url);
                const youtubeId = isYouTube ? getYouTubeVideoId(video.url) : null;

                return (
                  <div key={video.id} className="bg-slate-700 rounded-lg shadow-md overflow-hidden">
                    {isYouTube && youtubeId ? (
                      <div>
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}`}
                            title={video.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <div className="p-4">
                          <div className="mb-2">
                            {editingVideoTitle === video.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={videoTitle}
                                  onChange={(e) => setVideoTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveVideoTitle(video.id);
                                    if (e.key === 'Escape') handleCancelEditVideoTitle();
                                  }}
                                  className="flex-1 font-semibold bg-slate-600 text-slate-100 px-2 py-1 rounded border border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveVideoTitle(video.id)}
                                  disabled={loading}
                                  className="text-green-400 hover:text-green-300 disabled:opacity-50"
                                  title="Save"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleCancelEditVideoTitle}
                                  className="text-slate-400 hover:text-slate-300"
                                  title="Cancel"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 group">
                                <h3 className="font-semibold text-slate-100">{video.title}</h3>
                                <button
                                  onClick={() => {
                                    setEditingVideoTitle(video.id);
                                    setVideoTitle(video.title);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-300"
                                  title="Edit title"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteVideo(video.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                  title="Delete video"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mb-4">
                            Added: {new Date(video.addedDate).toLocaleDateString()}
                          </p>
                          {editingVideo === video.id ? (
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
                          onClick={() => handleSaveVideoText(video.id)}
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
                        onClick={() => handleEditVideoText(video.id, video.text || '')}
                        className="text-yellow-400 hover:text-yellow-300 text-sm"
                      >
                        {video.text ? 'Edit Text' : 'Add Text'}
                      </button>
                    </div>
                  )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="mb-2">
                          {editingVideoTitle === video.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={videoTitle}
                                onChange={(e) => setVideoTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveVideoTitle(video.id);
                                  if (e.key === 'Escape') handleCancelEditVideoTitle();
                                }}
                                className="flex-1 font-semibold bg-slate-600 text-slate-100 px-2 py-1 rounded border border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveVideoTitle(video.id)}
                                disabled={loading}
                                className="text-green-400 hover:text-green-300 disabled:opacity-50"
                                title="Save"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={handleCancelEditVideoTitle}
                                className="text-slate-400 hover:text-slate-300"
                                title="Cancel"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 group">
                              <h3 className="font-semibold text-slate-100">{video.title}</h3>
                              <button
                                onClick={() => {
                                  setEditingVideoTitle(video.id);
                                  setVideoTitle(video.title);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-300"
                                title="Edit title"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                title="Delete video"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
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

                        {editingVideo === video.id ? (
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
                                onClick={() => handleSaveVideoText(video.id)}
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
                              onClick={() => handleEditVideoText(video.id, video.text || '')}
                              className="text-yellow-400 hover:text-yellow-300 text-sm"
                            >
                              {video.text ? 'Edit Text' : 'Add Text'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {album.metadata.photos.length === 0 && album.metadata.videos.length === 0 && (
          <div className={`text-center py-12 ${message ? 'mt-20' : ''}`}>
            <div className="text-slate-400">No photos or videos in this album yet</div>
          </div>
        )}

        {/* Move Photo Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                Move Photo: {photoToMove?.title}
              </h2>

              <div className="flex-1 overflow-y-auto mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select destination album:
                </label>
                {availableAlbums.length > 0 ? (
                  <div className="space-y-2">
                    {availableAlbums.map((album) => (
                      <label
                        key={`${album.year}-${album.urlName}`}
                        className="flex items-center p-3 border border-slate-600 rounded-md hover:bg-slate-700 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="targetAlbum"
                          value={`${album.year}-${album.urlName}`}
                          checked={selectedTargetAlbum?.year === album.year && selectedTargetAlbum?.album === album.urlName}
                          onChange={() => setSelectedTargetAlbum({ year: album.year, album: album.urlName })}
                          className="mr-3 text-blue-500"
                        />
                        <span className="text-slate-200">{album.displayName}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-center py-4">
                    No other albums available
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCloseMoveModal}
                  disabled={movingPhoto}
                  className="px-4 py-2 text-slate-300 bg-slate-600 rounded-md hover:bg-slate-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMovePhoto}
                  disabled={!selectedTargetAlbum || movingPhoto}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {movingPhoto ? 'Moving...' : 'Move Photo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
