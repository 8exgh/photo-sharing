'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import {useSessionState} from "@/app/hooks/sessionState";
import SiteLogo from '@/components/SiteLogo';

interface AlbumInfo {
  albumId: string;
  name: string;
  urlName: string;
  description: string;
  groupId: string | null;
}

interface GroupInfo {
  id: string;
  displayName: string;
  description: string;
  albumCount: number;
}

interface UnifiedItem {
  type: 'group' | 'album';
  id: string;
  displayOrder: number;
  group?: GroupInfo;
  album?: AlbumInfo;
  albumsInGroup?: AlbumInfo[];
}

// Component for individual album item
function AlbumItem({ album, year }: { album: AlbumInfo; year: string }) {
  return (
    <Link
      href={`/albums/${year}/${album.urlName}`}
      className="block py-2 pl-12 pr-4 hover:bg-slate-700 rounded transition-colors"
    >
      <div className="text-slate-100">{album.name}</div>
      {album.description && (
        <div className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">
          {album.description}
        </div>
      )}
    </Link>
  );
}

// Component for group section with expand/collapse
function GroupSection({
  group,
  albums,
  year,
  isExpanded,
  onToggle
}: {
  group: GroupInfo;
  albums: AlbumInfo[];
  year: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left py-2 pl-8 pr-4 hover:bg-slate-700 rounded transition-colors flex items-center"
      >
        <span className="mr-2 text-slate-400 text-sm">
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="text-slate-200">{group.displayName}</span>
      </button>

      {isExpanded && (
        <div className="ml-4">
          {albums.map((album) => (
            <AlbumItem key={album.albumId} album={album} year={year} />
          ))}
          {albums.length === 0 && (
            <div className="pl-12 py-2 text-slate-500 italic">No albums in this group</div>
          )}
        </div>
      )}
    </div>
  );
}

// Component for year section with expand/collapse
function YearSection({
  year,
  isExpanded,
  onToggle
}: {
  year: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [unifiedItems, setUnifiedItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useSessionState<Set<string>>(`albums-year-${year}-group-expanded`, new Set());

  const fetchYearData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch unified items to get groups and albums in correct order
      const itemsResponse = await fetch(`/api/items?year=${year}`, {
        cache: 'no-store',
      });

      if (itemsResponse.status === 401) {
        window.location.href = '/access-denied';
        return;
      }

      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setUnifiedItems(itemsData.items || []);
        setLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching year data:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (isExpanded && !loaded) {
      fetchYearData();
    }
  }, [isExpanded, loaded, fetchYearData]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };


  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left py-3 px-4 hover:bg-slate-700 rounded transition-colors flex items-center text-lg"
      >
        <span className="mr-2 text-slate-400">
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="text-slate-100 font-medium">{year}</span>
      </button>

      {isExpanded && (
        <div className="ml-4">
          {loading ? (
            <div className="pl-4 py-2 text-slate-400">Loading...</div>
          ) : (
            <>
              {/* Render items in unified order */}
              {unifiedItems.map((item) => {
                if (item.type === 'group' && item.group) {
                  const group = item.group;
                  return (
                    <GroupSection
                      key={item.id}
                      group={group}
                      albums={item.albumsInGroup || []}
                      year={year}
                      isExpanded={expandedGroups.has(group.id)}
                      onToggle={() => toggleGroup(group.id)}
                    />
                  );
                } else if (item.type === 'album' && item.album) {
                  return (
                    <div key={item.id} className="pl-4">
                      <AlbumItem album={item.album} year={year} />
                    </div>
                  );
                }
                return null;
              })}

              {/* Empty state */}
              {unifiedItems.length === 0 && (
                <div className="pl-4 py-2 text-slate-500 italic">No albums for this year</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AlbumsContent() {
  const [years, setYears] = useState<string[]>([]);
  const [expandedYears, setExpandedYears] = useSessionState<Set<string>>('albums-expanded-years', new Set([]));
  const [loading, setLoading] = useState(true);

  const fetchYears = useCallback(async () => {
    try {
      const response = await fetch('/api/albums', {
        cache: 'no-store',
      });

      if (response.status === 401) {
        window.location.href = '/access-denied';
        return;
      }

      const data = await response.json();
      // Sort years in descending order (newest first)
      const sortedYears = (data.years || []).sort((a: string, b: string) => b.localeCompare(a));
      setYears(sortedYears);

      // Optionally expand the current year by default
      if (sortedYears.length > 0) {
        const currentYear = new Date().getFullYear().toString();
        if (sortedYears.includes(currentYear)) {
          if(!expandedYears.has('initialized')) {
            setExpandedYears(new Set([currentYear, 'initialized']));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching years:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="text-lg text-slate-300">Loading albums...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Photo Albums</h1>
            <div className="flex items-center text-sm text-emerald-400">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Secure Access - Session Active
            </div>
          </div>
          <SiteLogo />
        </div>

        {/* Hierarchical Album List */}
        <div className="bg-slate-900 rounded-lg p-4">
          {years.length > 0 ? (
            <div className="space-y-1">
              {years.map((year) => (
                <YearSection
                  key={year}
                  year={year}
                  isExpanded={expandedYears.has(year)}
                  onToggle={() => toggleYear(year)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400">No albums found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Albums() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="text-lg text-slate-300">Loading albums...</div>
      </div>
    }>
      <AlbumsContent />
    </Suspense>
  );
}
