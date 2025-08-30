'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { GroupMetadata, AlbumWithGroup } from '@/types';

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
  groupId?: string;
  isNested?: boolean;
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
  const [groupMetadata, setGroupMetadata] = useState<GroupMetadata | null>(null);
  const [groupAlbums, setGroupAlbums] = useState<AlbumWithGroup[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<number | null>(null);

  const fetchAlbumOrGroup = useCallback(async () => {
    try {
      // First try to fetch as a group
      const groupResponse = await fetch(`/api/groups/${params.year}/${params.album}`, {
        cache: 'no-store',
      });
      
      if (groupResponse.status === 401) {
        // Access denied - redirect to access-denied page
        window.location.href = '/access-denied';
        return;
      }
      
      if (groupResponse.ok) {
        const groupData = await groupResponse.json();
        setGroupMetadata(groupData.group);
        setIsGroup(true);
        
        // Fetch albums in this group
        const albumsResponse = await fetch(`/api/albums?year=${params.year}`, {
          cache: 'no-store',
        });
        
        if (albumsResponse.status === 401) {
          // Access denied - redirect to access-denied page
          window.location.href = '/access-denied';
          return;
        }
        
        const albumsData = await albumsResponse.json();
        const filteredAlbums = albumsData.albums.filter((album: AlbumWithGroup) => album.groupId === params.album);
        setGroupAlbums(filteredAlbums);
      } else {
        // Try to fetch as an album
        const albumResponse = await fetch(`/api/albums/${params.year}/${params.album}`, {
          cache: 'no-store',
        });
        
        if (albumResponse.status === 401) {
          // Access denied - redirect to access-denied page
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

  const openPhotoModal = (photo: string) => {
    setSelectedPhoto(photo);
  };

  const closePhotoModal = () => {
    setSelectedPhoto(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!album || !selectedPhoto) return;
    
    const currentIndex = album.photos.indexOf(selectedPhoto);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : album.photos.length - 1;
    } else {
      newIndex = currentIndex < album.photos.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedPhoto(album.photos[newIndex]);
  };

  const getBackUrl = () => {
    if (album?.groupId) {
      return `/albums/${params.year}/${album.groupId}`;
    }
    return `/albums?year=${params.year}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading album...</div>
      </div>
    );
  }

  if (error || (!album && !isGroup)) {
    return (
      <div className="min-h-screen bg-slate-800">
        {/* Fixed error banner at top */}
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
        
        {/* Page content with top padding to account for fixed banner */}
        <div className="pt-20 flex items-center justify-center min-h-screen">
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
  if (isGroup && groupMetadata) {
    return (
      <div className="min-h-screen bg-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <nav className="flex text-sm text-slate-400">
              <Link href={`/albums?year=${params.year}`} className="hover:text-slate-300">Albums</Link>
              <span className="mx-2">&gt;</span>
              <Link href={`/albums?year=${params.year}`} className="hover:text-slate-300">{params.year}</Link>
              <span className="mx-2">&gt;</span>
              <span className="text-slate-200">{groupMetadata.displayName}</span>
            </nav>
          </div>

          {/* Group Header */}
          <div className="mb-8">
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
              {groupMetadata.displayName}
            </h1>
            {groupMetadata.description && (
              <p className="text-slate-300 mb-4">{groupMetadata.description}</p>
            )}
            <div className="flex items-center text-sm text-emerald-400">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Secure Access - Session Active
            </div>
          </div>

          {/* Albums Grid */}
          {groupAlbums.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupAlbums.map((album) => (
                <Link
                  key={album.path}
                  href={`/albums/${params.year}/${album.name}`}
                  className={`block bg-slate-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg hover:bg-slate-600 transition-all duration-300 ${
                    album.isNested ? 'ml-8 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="h-48 bg-slate-600 relative overflow-hidden flex items-center justify-center">
                    {album.firstPhoto ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/thumbnails/${album.path.split('public/albums/')[1]}/${album.firstPhoto}`}
                        alt={`${album.metadata?.name || album.name} preview`}
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
                    
                    {/* Overlay for album info on hover - positioned to not interfere with image */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <p className="text-sm font-medium text-white truncate">
                        {album.metadata?.photos?.length || 0} photos
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">
                      {album.metadata?.name || album.name}
                      {album.isNested && <span className="ml-2 text-blue-400 text-sm">(nested)</span>}
                    </h3>
                    {album.metadata?.location && (
                      <p className="text-sm text-slate-300 mb-1">
                        📍 {album.metadata.location}
                      </p>
                    )}
                    {album.metadata?.description && (
                      <p className="text-sm text-slate-300 mb-2">
                        {album.metadata.description}
                      </p>
                    )}
                    {!true &&  (<p className="text-xs text-slate-400">
                      Created: {album.metadata?.created ? new Date(album.metadata.created).toLocaleDateString() : 'Unknown'}
                    </p>) }
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

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href={getBackUrl()}
            className="text-blue-400 hover:text-blue-300 mb-4 inline-flex items-center"
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {album?.groupId ? 'Back to Group' : 'Back to Albums'}
          </Link>
          
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            {album?.metadata.name}
          </h1>
          
          {album?.metadata.location && (
            <p className="text-slate-300 mb-2">📍 {album.metadata.location}</p>
          )}
          
          {album?.metadata.description && (
            <p className="text-slate-300 mb-4">{album.metadata.description}</p>
          )}

          {!true && (<p className="text-sm text-slate-400">
            Created: {album?.metadata.created ? new Date(album.metadata.created).toLocaleDateString() : 'Unknown'}
          </p>)}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Photos and Videos */}
          <div className="lg:col-span-2">

        {/* Photos Grid */}
        {album && album.photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {album.photos.map((photo, index) => (
              <div
                key={photo}
                className="relative aspect-square bg-slate-600 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg hover:bg-slate-500 transition-all duration-300"
                onClick={() => openPhotoModal(photo)}
              >
                <Image
                  src={`/api/thumbnails/${album.albumPath}/${photo}`}
                  alt={`Photo ${index + 1}`}
                  fill
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
                    key={index} 
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
                          <p className="text-sm text-slate-400 mt-1">
                            Added: {new Date(video.addedDate).toLocaleDateString()}
                          </p>
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
                        {!true &&  (<p className="text-sm text-slate-400 mt-2">
                          Added: {new Date(video.addedDate).toLocaleDateString()}
                        </p>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo Modal */}
        {selectedPhoto && album && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="relative max-w-6xl max-h-full p-4 w-full">
              <button
                onClick={closePhotoModal}
                className="absolute top-2 right-2 text-white hover:text-slate-300 z-10"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[90vh]">
                {/* Left side: Image */}
                <div className="lg:col-span-2 flex items-center justify-center">
                  <div className="relative">
                    <Image
                      src={`/api/images/${album.albumPath}/${selectedPhoto}`}
                      alt="Full size photo"
                      width={800}
                      height={600}
                      className="max-w-full max-h-[70vh] object-contain"
                    />
                  </div>
                </div>
                
                {/* Right side: Text and controls */}
                <div className="lg:col-span-1 flex flex-col">
                  <div className="bg-slate-800 rounded-lg p-4 flex-1 min-h-0">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {(() => {
                        const photo = album.metadata.photos.find(p => p.filename === selectedPhoto);
                        return photo?.title || selectedPhoto;
                      })()}
                    </h3>

                    {!true && (<div className="text-sm text-slate-400 mb-4">
                      {(() => {
                        const photo = album.metadata.photos.find(p => p.filename === selectedPhoto);
                        return photo?.uploadDate ? new Date(photo.uploadDate).toLocaleDateString() : '';
                      })()}
                    </div>)}
                    
                    <div className="flex-1 overflow-y-auto">
                      {(() => {
                        const photo = album.metadata.photos.find(p => p.filename === selectedPhoto);
                        return photo?.text ? (
                          <div>
                            <h4 className="text-slate-300 font-medium mb-2">Description</h4>
                            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {photo.text}
                            </p>
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">No description available</p>
                        );
                      })()}
                    </div>
                  </div>
                  
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
                      {album.photos.indexOf(selectedPhoto) + 1} of {album.photos.length}
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
                </div>
              </div>
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
                        (!true && (<p className="text-sm text-slate-400 mb-4">
                          Added: {new Date(video.addedDate).toLocaleDateString()}
                        </p>)}
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
              {selectedPhoto && album && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-200 mb-2">Photo Details</h3>
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-sm mb-2">
                      {selectedPhoto}
                    </p>
                    {(() => {
                      const photo = album.metadata.photos.find(p => p.filename === selectedPhoto);
                      return photo?.text ? (
                        <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {photo.text}
                        </p>
                      ) : (
                        <p className="text-slate-400 italic">No description available</p>
                      );
                    })()}
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
              
              {/* Album Stats */}
              {!true && (<div  className="text-sm text-slate-400 space-y-1">
                <p>{album?.photos.length || 0} photos</p>
                <p>{album?.metadata.videos.length || 0} videos</p>
                <p>Created: {album?.metadata.created ? new Date(album.metadata.created).toLocaleDateString() : 'Unknown'}</p>
              </div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}