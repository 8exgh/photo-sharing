'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import SiteLogo from '@/components/SiteLogo';

interface PhotoInfo {
  id: string;
  originalFilename: string;
  title: string;
  text: string;
  width: number;
  height: number;
  fileSize: number;
  uploadDate: string;
}

interface VideoInfo {
  id: string;
  url: string;
  title: string;
  text: string;
  addedDate: string;
}

interface AlbumData {
  albumId: string;
  metadata: {
    name: string;
    location: string;
    description: string;
    text?: string;
    created: string;
    photos: PhotoInfo[];
    videos: VideoInfo[];
  };
  groupId?: string;
  firstPhotoId?: string;
}

interface GroupData {
  group: {
    id: string;
    displayName: string;
    description: string;
    albumCount: number;
  };
}

interface AlbumWithGroupInfo {
  albumId: string;
  name: string;
  urlName: string;
  description: string;
  location: string;
  firstPhotoId: string | null;
  groupId: string | null;
  photoCount: number;
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

export default function AlbumView() {
  const params = useParams();
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [groupAlbums, setGroupAlbums] = useState<AlbumWithGroupInfo[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<number | null>(null);
  const [selectedPhotoIsFullScreen, setSelectedPhotoIsFullScreen] = useState(false);

  const fetchAlbumOrGroup = useCallback(async () => {
    try {
      // First try to fetch as a group
      const groupResponse = await fetch(`/api/groups/${params.year}/${params.album}`, {
        cache: 'no-store',
      });

      if (groupResponse.status === 401) {
        window.location.href = '/access-denied';
        return;
      }

      if (groupResponse.ok) {
        const gData = await groupResponse.json();
        setGroupData(gData);
        setIsGroup(true);

        // Fetch albums in this group
        const albumsResponse = await fetch(`/api/albums?year=${params.year}`, {
          cache: 'no-store',
        });

        if (albumsResponse.status === 401) {
          window.location.href = '/access-denied';
          return;
        }

        const albumsData = await albumsResponse.json();
        const filteredAlbums = (albumsData.albums || []).filter((a: AlbumWithGroupInfo) => a.groupId === params.album);
        setGroupAlbums(filteredAlbums);
      } else {
        // Try to fetch as an album
        const albumResponse = await fetch(`/api/albums/${params.year}/${params.album}`, {
          cache: 'no-store',
        });

        if (albumResponse.status === 401) {
          window.location.href = '/access-denied';
          return;
        }

        const albumData = await albumResponse.json();

        if (albumResponse.ok) {
          setAlbum(albumData);
          setIsGroup(false);
        } else {
          setError(albumData.error || 'Album/Group not found');
        }
      }
    } catch (_error) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [params.year, params.album]);

  useEffect(() => {
    fetchAlbumOrGroup();
  }, [fetchAlbumOrGroup]);

  const openPhotoModal = (photoId: string) => {
    setSelectedPhotoId(photoId);
  };

  const closePhotoModal = () => {
    setSelectedPhotoId(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!album || !selectedPhotoId) return;

    const photos = album.metadata.photos;
    const currentIndex = photos.findIndex(p => p.id === selectedPhotoId);
    let newIndex;

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    } else {
      newIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    }

    setSelectedPhotoId(photos[newIndex].id);
  };

  const toggleFullScreenPhoto = () => {
    setSelectedPhotoIsFullScreen(!selectedPhotoIsFullScreen);
  };

  const getBackUrl = () => {
    return `/albums?year=${params.year}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-lg">Loading album...</div>
      </div>
    );
  }

  if (error || (!album && !isGroup)) {
    return (
      <div className="flex-1 bg-slate-800 flex flex-col">
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-900 text-red-100 border-b border-red-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error || 'Album/Group not found'}</span>
            </div>
          </div>
        </div>

        <div className="pt-20 flex items-center justify-center flex-1">
          <div className="text-slate-400 text-center">
            <svg className="h-16 w-16 mx-auto mb-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.87 0-5.431 1.512-6.86 3.757l1.378.378a6.002 6.002 0 0111.964 0l1.378-.378A7.962 7.962 0 0112 15z" />
            </svg>
            <p>The requested content could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  // Render group view
  if (isGroup && groupData) {
    return (
      <div className="flex-1 bg-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <nav className="flex text-sm text-slate-400">
              <Link href={`/albums?year=${params.year}`} className="hover:text-slate-300">Albums</Link>
              <span className="mx-2">&gt;</span>
              <Link href={`/albums?year=${params.year}`} className="hover:text-slate-300">{params.year}</Link>
              <span className="mx-2">&gt;</span>
              <span className="text-slate-200">{groupData.group.displayName}</span>
            </nav>
          </div>

          {/* Group Header */}
          <div className="mb-8 flex justify-between items-start gap-4">
            <div>
            <Link
              href={`/albums?year=${params.year}`}
              className="text-blue-400 hover:text-blue-300 mb-4 inline-flex items-center"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Albums
            </Link>

            <h1 className="text-3xl font-bold text-slate-100 mb-2">
              {groupData.group.displayName}
            </h1>
            {groupData.group.description && (
              <p className="text-slate-300 mb-4">{groupData.group.description}</p>
            )}
            <div className="flex items-center text-sm text-emerald-400">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Secure Access - Session Active
            </div>
            </div>
            <SiteLogo />
          </div>

          {/* Albums Grid */}
          {groupAlbums.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupAlbums.map((album) => (
                <Link
                  key={album.albumId}
                  href={`/albums/${params.year}/${album.urlName}`}
                  className="block bg-slate-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg hover:bg-slate-600 transition-all duration-300"
                >
                  <div className="h-48 bg-slate-600 relative overflow-hidden flex items-center justify-center">
                    {album.firstPhotoId ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/thumbnails/${album.firstPhotoId}`}
                        alt={`${album.name} preview`}
                        className="max-w-full max-h-full object-contain"
                        style={{ display: 'block' }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-slate-600">
                        <svg className="h-16 w-16 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <p className="text-sm font-medium text-white truncate">
                        {album.photoCount || 0} photos
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">
                      {album.name}
                    </h3>
                    {album.location && (
                      <p className="text-sm text-slate-300 mb-1">
                        📍{' '}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(album.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400 hover:underline transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="Open in Google Maps"
                        >
                          {album.location}
                        </a>
                      </p>
                    )}
                    {album.description && (
                      <p className="text-sm text-slate-300 mb-2">
                        {album.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400">No albums found in this group</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Get current selected photo info
  const selectedPhoto = album?.metadata.photos.find(p => p.id === selectedPhotoId);
  const selectedPhotoIndex = album?.metadata.photos.findIndex(p => p.id === selectedPhotoId) ?? -1;

  return (
    <div className="flex-1 bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-start gap-4">
          <div>
          <Link
            href={getBackUrl()}
            className="text-blue-400 hover:text-blue-300 mb-4 inline-flex items-center"
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Albums
          </Link>

          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            {album?.metadata.name}
          </h1>

          {album?.metadata.location && (
            <p className="text-slate-300 mb-2">
              📍{' '}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(album.metadata.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 hover:underline transition-colors"
                title="Open in Google Maps"
              >
                {album.metadata.location}
              </a>
            </p>
          )}

          {album?.metadata.description && (
            <p className="text-slate-300 mb-4">{album.metadata.description}</p>
          )}
          </div>
          <SiteLogo />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Photos and Videos */}
          <div className="lg:col-span-2">

        {/* Photos Grid */}
        {album && album.metadata.photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {album.metadata.photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-square bg-slate-600 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg hover:bg-slate-500 transition-all duration-300"
                onClick={() => openPhotoModal(photo.id)}
              >
                <Image
                  src={`/api/thumbnails/${photo.id}`}
                  alt={`Photo ${index + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-slate-400">No photos in this album yet</div>
          </div>
        )}

        {/* Videos Section */}
        {album && album.metadata.videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {album.metadata.videos.map((video, index) => {
                const isYouTube = isYouTubeUrl(video.url);
                const youtubeId = isYouTube ? getYouTubeVideoId(video.url) : null;

                return (
                  <div
                    key={video.id}
                    className="bg-slate-700 rounded-lg shadow-md overflow-hidden"
                  >
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
                          <h3 className="font-semibold text-slate-100">{video.title}</h3>
                          {video.text && (
                            <div
                              className="mt-2 cursor-pointer text-blue-400 hover:text-blue-300 text-sm"
                              onClick={() => setSelectedVideo(index)}
                            >
                              View details →
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="p-4 cursor-pointer hover:bg-slate-600 transition-colors"
                        onClick={() => setSelectedVideo(index)}
                      >
                        <h3 className="font-semibold mb-2 text-slate-100">{video.title}</h3>
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Watch Video →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo Modal */}
        {selectedPhotoId && album && selectedPhoto && (
          <div className="fixed m-0 p-0 gap-0 inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 ">
            <div className="relative m-0 p-0 w-full h-full max-h-full flex flex-col lg:flex-row gap-0">

              {/* Photo Container */}
              <div className="flex-1 m-0 p-0 flex items-center justify-center min-h-0 min-w-0 relative">
                <Image
                    src={`/api/images/${selectedPhotoId}`}
                    alt="Full size photo"
                    fill
                    unoptimized
                    className="object-contain"
                />
                <button
                    onClick={toggleFullScreenPhoto}
                    className={`absolute top-4 ${selectedPhotoIsFullScreen ? 'right-4' : 'right-15'}  z-10 text-white hover:text-slate-300 p-2 bg-slate-700 rounded-lg`}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>

                {(!selectedPhotoIsFullScreen && <button
                    onClick={closePhotoModal}
                    className=" absolute top-4 right-4 z-10 text-white hover:text-slate-300 p-2 bg-slate-700 rounded-lg"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>)}

              </div>

              {(!selectedPhotoIsFullScreen &&  <div className="lg:w-80 lg:max-w-sm bg-white rounded-lg p-6 overflow-y-auto lg:max-h-full max-h-48">
                  <div className="bg-slate-800 rounded-lg p-4 flex-1 min-h-0">

                    {/* Navigation controls */}
                    <div className="flex justify-between items-center mt-4">
                      <button
                          onClick={() => navigatePhoto('prev')}
                          className="text-white hover:text-slate-300 p-2 bg-slate-700 rounded-lg"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <div className="text-white text-center">
                        {selectedPhotoIndex + 1} of {album.metadata.photos.length}
                      </div>

                      <button
                          onClick={() => navigatePhoto('next')}
                          className="text-white hover:text-slate-300 p-2 bg-slate-700 rounded-lg"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2 mt-2">
                      {selectedPhoto.text}
                    </h3>

                    <div className="flex-1 overflow-y-auto">
                      {selectedPhoto.text ? (
                        <div>
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {selectedPhoto.text}
                          </p>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No description available</p>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Modal */}
        {selectedVideo !== null && album && album.metadata.videos[selectedVideo] && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="relative max-w-4xl max-h-full p-4 w-full">
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 text-white hover:text-slate-300 z-10"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="bg-slate-800 rounded-lg overflow-hidden">
                {(() => {
                  const video = album.metadata.videos[selectedVideo];
                  const isYouTube = isYouTubeUrl(video.url);
                  const youtubeId = isYouTube ? getYouTubeVideoId(video.url) : null;

                  return (
                    <div>
                      {isYouTube && youtubeId ? (
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                            title={video.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <h2 className="text-2xl font-bold text-slate-100 mb-4">{video.title}</h2>
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                          >
                            Open Video in New Tab →
                          </a>
                        </div>
                      )}

                      <div className="p-6">
                        <h2 className="text-xl font-bold text-slate-100 mb-2">{video.title}</h2>
                        {video.text && (
                          <div className="p-4 bg-slate-700 rounded-lg">
                            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {video.text}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
          </div>

          {/* Right column: Text Content */}
          <div className="lg:col-span-1">
            <div className="bg-slate-700 rounded-lg p-6 sticky top-8">

              {/* Album Text */}
              {album?.metadata.text && (
                <div className="mb-6">
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {album.metadata.text}
                    </p>
                  </div>
                </div>
              )}

              {/* Selected Photo Text */}
              {selectedPhotoId && album && selectedPhoto && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-200 mb-2">Photo Details</h3>
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-sm mb-2">
                      {selectedPhoto.title}
                    </p>
                    {selectedPhoto.text ? (
                      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {selectedPhoto.text}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">No description available</p>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Video Text */}
              {selectedVideo !== null && album && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-200 mb-2">Video Details</h3>
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-sm mb-2">
                      {album.metadata.videos[selectedVideo]?.title}
                    </p>
                    {album.metadata.videos[selectedVideo]?.text ? (
                      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {album.metadata.videos[selectedVideo].text}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">No description available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
