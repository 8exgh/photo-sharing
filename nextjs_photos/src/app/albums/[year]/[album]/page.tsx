'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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

export default function AlbumView() {
  const params = useParams();
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<number | null>(null);

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
        setError(data.error || 'Failed to load album');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading album...</div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error || 'Album not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/albums"
            className="text-blue-400 hover:text-blue-300 mb-4 inline-flex items-center"
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Albums
          </Link>
          
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            {album.metadata.name}
          </h1>
          
          {album.metadata.location && (
            <p className="text-slate-300 mb-2">📍 {album.metadata.location}</p>
          )}
          
          {album.metadata.description && (
            <p className="text-slate-300 mb-4">{album.metadata.description}</p>
          )}
          
          <p className="text-sm text-slate-400">
            Created: {new Date(album.metadata.created).toLocaleDateString()}
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Photos and Videos */}
          <div className="lg:col-span-2">

        {/* Photos Grid */}
        {album.photos.length > 0 ? (
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
        {album.metadata.videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {album.metadata.videos.map((video, index) => (
                <div 
                  key={index} 
                  className="bg-slate-700 rounded-lg shadow-md p-4 cursor-pointer hover:bg-slate-600 transition-colors"
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
                  <p className="text-sm text-slate-400 mt-2">
                    Added: {new Date(video.addedDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo Modal */}
        {selectedPhoto && (
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
                    
                    <div className="text-sm text-slate-400 mb-4">
                      {(() => {
                        const photo = album.metadata.photos.find(p => p.filename === selectedPhoto);
                        return photo?.uploadDate ? new Date(photo.uploadDate).toLocaleDateString() : '';
                      })()}
                    </div>
                    
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
          </div>

          {/* Right column: Text Content */}
          <div className="lg:col-span-1">
            <div className="bg-slate-700 rounded-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Album Information</h2>
              
              {/* Album Text */}
              {album.metadata.text && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-200 mb-2">About this Album</h3>
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {album.metadata.text}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Selected Photo Text */}
              {selectedPhoto && (
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
              {selectedVideo !== null && (
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
              <div className="text-sm text-slate-400 space-y-1">
                <p>{album.photos.length} photos</p>
                <p>{album.metadata.videos.length} videos</p>
                <p>Created: {new Date(album.metadata.created).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}