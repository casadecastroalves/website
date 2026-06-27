import React, { useState, useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Search, 
  MapPin, 
  Layers, 
  Plus, 
  BookOpen, 
  Users, 
  Award, 
  Sparkles, 
  X, 
  Compass, 
  Info, 
  CheckCircle, 
  Share2, 
  Copy, 
  Mail, 
  PlusCircle, 
  Heart,
  Globe,
  Map as MapIcon,
  Check,
  AlertCircle,
  Locate
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { territoriesData } from './data/territories';
import { Territory, FilterCategory } from './types';

// Map Styles mapping (free CartoDB base maps that don't require API keys)
const MAP_STYLES = {
  voyager: {
    name: 'Colorido (Voyager)',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
  },
  positron: {
    name: 'Mínimo (Positron)',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  },
  dark: {
    name: 'Contraste Escuro',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  }
};

export default function App() {
  // State variables
  const [territories, setTerritories] = useState<Territory[]>(territoriesData);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('todos');
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('voyager');
  const [isLocating, setIsLocating] = useState(false);
  
  // Modals and notifications
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSelectingCoords, setIsSelectingCoords] = useState(false);
  
  // New Territory Form State
  const [newTerritory, setNewTerritory] = useState<Partial<Territory>>({
    name: '',
    category: 'quilombo',
    city: '',
    state: 'Bahia',
    coordinates: [-38.5016, -12.9714], // Default Salvador coords
    description: '',
    history: '',
    heritageStatus: '',
    leader: '',
    founded: '',
    activities: [],
    imageUrl: 'https://images.unsplash.com/photo-1540206395-68808572332f?auto=format&fit=crop&q=80&w=600',
    contact: ''
  });
  const [newActivityInput, setNewActivityInput] = useState('');

  // DOM Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = territories.length;
    const quilombos = territories.filter(t => t.category === 'quilombo').length;
    const cultura = territories.filter(t => t.category === 'cultura').length;
    const tradicional = territories.filter(t => t.category === 'tradicional').length;
    return { total, quilombos, cultura, tradicional };
  }, [territories]);

  // Filtered list based on active category and search text
  const filteredTerritories = useMemo(() => {
    return territories.filter(t => {
      const matchesCategory = activeCategory === 'todos' || t.category === activeCategory;
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.leader && t.leader.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.activities.some(act => act.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [territories, activeCategory, searchQuery]);

  // Toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Geolocation Handler
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      triggerToast('A geolocalização não é suportada por este navegador.');
      return;
    }

    setIsLocating(true);
    triggerToast('Buscando sua localização atual...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setIsLocating(false);
        triggerToast('Localização obtida com sucesso!');

        const map = mapRef.current;
        if (map) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: 12.5,
            essential: true,
            duration: 1800,
            pitch: 0
          });
        }

        // Add/Update user location marker on the map
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
        }

        const userEl = document.createElement('div');
        userEl.className = 'relative flex items-center justify-center z-50';
        userEl.innerHTML = `
          <span class="absolute inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-40 animate-ping"></span>
          <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-600 border-2 border-white shadow-xl"></span>
        `;

        if (map) {
          const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
            <div class="text-xs p-1">
              <p class="font-semibold text-slate-800">Sua Posição</p>
              <p class="text-slate-500 text-[10px] mt-0.5">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>
            </div>
          `);

          const newUserMarker = new maplibregl.Marker({ element: userEl })
            .setLngLat([longitude, latitude])
            .setPopup(popup)
            .addTo(map);

          userMarkerRef.current = newUserMarker;
        }
      },
      (error) => {
        setIsLocating(false);
        console.error('Erro ao obter localização:', error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            triggerToast('Permissão de geolocalização negada pelo usuário.');
            break;
          case error.POSITION_UNAVAILABLE:
            triggerToast('Sinal de GPS indisponível ou posição desconhecida.');
            break;
          case error.TIMEOUT:
            triggerToast('Tempo limite excedido ao obter localização.');
            break;
          default:
            triggerToast('Não foi possível obter sua localização atual.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Keyboard shortcut Ctrl+K / Cmd+K to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Centered around Recôncavo Baiano / Salvador
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyle].url,
      center: [-38.6500, -12.8200], // Bahia center
      zoom: 9.2,
      maxBounds: [
        [-43.0000, -16.0000], // Southwest Bahia
        [-36.0000, -9.0000]   // Northeast Bahia
      ],
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    // Listen to click events on map for coordinates selection mode
    map.on('click', (e) => {
      // Check if we are in selecting coordinates mode
      if (setIsSelectingCoords) {
        const { lng, lat } = e.lngLat;
        // Check if we actually are active in coordinate selecting mode
        // We use function state update to avoid stale closures
        setIsSelectingCoords(current => {
          if (current) {
            setNewTerritory(prev => ({
              ...prev,
              coordinates: [parseFloat(lng.toFixed(5)), parseFloat(lat.toFixed(5))]
            }));
            triggerToast(`Coordenadas capturadas: ${lng.toFixed(5)}, ${lat.toFixed(5)}`);
            return false; // Toggle off mode
          }
          return current;
        });
      }
    });

    // Automatically try to geolocate on initial load
    map.on('load', () => {
      setTimeout(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            map.flyTo({
              center: [longitude, latitude],
              zoom: 11.5,
              essential: true,
              duration: 1800
            });

            const userEl = document.createElement('div');
            userEl.className = 'relative flex items-center justify-center z-50';
            userEl.innerHTML = `
              <span class="absolute inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-40 animate-ping"></span>
              <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-600 border-2 border-white shadow-xl"></span>
            `;

            const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
              <div class="text-xs p-1">
                <p class="font-semibold text-slate-800">Sua Posição</p>
                <p class="text-slate-500 text-[10px] mt-0.5">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>
              </div>
            `);

            const newUserMarker = new maplibregl.Marker({ element: userEl })
              .setLngLat([longitude, latitude])
              .setPopup(popup)
              .addTo(map);

            userMarkerRef.current = newUserMarker;
          },
          (error) => {
            console.warn('Geolocalização automática inicial recusada ou indisponível:', error);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }, 1500);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Sync map style when state changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[mapStyle].url);
    }
  }, [mapStyle]);

  // Update Map Markers on Filter or Search Change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Create markers for filtered territories
    filteredTerritories.forEach(t => {
      const isSelected = selectedTerritory?.id === t.id;

      // Custom marker element
      const el = document.createElement('div');
      el.id = `marker-${t.id}`;
      
      // Color definition
      let bgColor = 'bg-emerald-600';
      let ringColor = 'ring-emerald-200';
      let iconHex = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
      
      if (t.category === 'cultura') {
        bgColor = 'bg-amber-500';
        ringColor = 'ring-amber-200';
      } else if (t.category === 'tradicional') {
        bgColor = 'bg-sky-500';
        ringColor = 'ring-sky-200';
      }

      el.className = `flex items-center justify-center rounded-full text-white cursor-pointer transition-all duration-300 shadow-xl border border-white/60 ${bgColor} ${
        isSelected ? 'w-10 h-10 ring-4 ' + ringColor + ' scale-110 z-30' : 'w-8 h-8 hover:scale-115 hover:z-20'
      }`;

      // Custom marker inner SVG
      el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 ${isSelected ? 'marker-pulse' : ''}">
          <path d="${iconHex}" />
        </svg>
      `;

      // Set up simple click callback on marker
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSelectTerritory(t);
      });

      // MapLibre popup on hover (brief summary)
      const popup = new maplibregl.Popup({
        offset: 15,
        closeButton: false,
        closeOnClick: false
      }).setHTML(`
        <div class="text-xs p-1">
          <p class="font-display font-semibold text-slate-900">${t.name}</p>
          <p class="text-slate-500 mt-0.5">${t.city}, ${t.state}</p>
          <span class="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-medium rounded capitalize ${
            t.category === 'quilombo' ? 'bg-emerald-50 text-emerald-700' :
            t.category === 'cultura' ? 'bg-amber-50 text-amber-700' :
            'bg-sky-50 text-sky-700'
          }">${t.category}</span>
        </div>
      `);

      el.addEventListener('mouseenter', () => {
        if (mapRef.current) {
          popup.setLngLat(t.coordinates).addTo(mapRef.current);
        }
      });

      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      // Add to Map
      try {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(t.coordinates)
          .addTo(map);

        markersRef.current.push(marker);
      } catch (err) {
        console.error('Erro ao adicionar marcador:', err);
      }
    });

    // If a territory was selected but is no longer in filtered lists, don't clear selectedState, but keep markers in sync.
  }, [filteredTerritories, selectedTerritory]);

  // Handler for selecting a territory
  const handleSelectTerritory = (t: Territory) => {
    setSelectedTerritory(t);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: t.coordinates,
        zoom: 12.5,
        essential: true,
        duration: 1800,
        pitch: 25
      });
    }
  };

  // Handler to center view back on whole Recôncavo
  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [-38.6500, -12.8200],
        zoom: 9.2,
        pitch: 0,
        essential: true,
        duration: 1500
      });
    }
    setSelectedTerritory(null);
  };

  // Add customized activities to form
  const handleAddActivity = () => {
    if (newActivityInput.trim() && newTerritory.activities) {
      if (!newTerritory.activities.includes(newActivityInput.trim())) {
        setNewTerritory({
          ...newTerritory,
          activities: [...newTerritory.activities, newActivityInput.trim()]
        });
      }
      setNewActivityInput('');
    }
  };

  // Delete activity from form list
  const handleRemoveActivity = (actToRemove: string) => {
    if (newTerritory.activities) {
      setNewTerritory({
        ...newTerritory,
        activities: newTerritory.activities.filter(a => a !== actToRemove)
      });
    }
  };

  // Handle Form Submission (Add to local list)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerritory.name || !newTerritory.city || !newTerritory.description) {
      triggerToast('Por favor, preencha o Nome, Município e a Descrição.');
      return;
    }

    const uniqueId = `custom-${Date.now()}`;
    const formattedTerritory: Territory = {
      id: uniqueId,
      name: newTerritory.name,
      category: newTerritory.category as 'quilombo' | 'cultura' | 'tradicional',
      coordinates: newTerritory.coordinates as [number, number],
      city: newTerritory.city,
      state: newTerritory.state || 'Bahia',
      description: newTerritory.description,
      history: newTerritory.history || 'Histórico em processo de compilação comunitária.',
      heritageStatus: newTerritory.heritageStatus || 'Em processo de certificação.',
      leader: newTerritory.leader || 'Coordenação Coletiva',
      founded: newTerritory.founded || 'Não especificado',
      activities: newTerritory.activities && newTerritory.activities.length > 0 
        ? newTerritory.activities 
        : ['Agricultura Familiar', 'Preservação da Cultura'],
      imageUrl: newTerritory.imageUrl || 'https://images.unsplash.com/photo-1540206395-68808572332f?auto=format&fit=crop&q=80&w=600',
      contact: newTerritory.contact || 'movimento.irun@gmail.com'
    };

    const updatedList = [formattedTerritory, ...territories];
    setTerritories(updatedList);
    
    // Save to localStorage if possible
    try {
      localStorage.setItem('irun_custom_territories', JSON.stringify(updatedList));
    } catch (err) {
      console.warn('LocalStorage indisponível', err);
    }

    // Reset Form
    setNewTerritory({
      name: '',
      category: 'quilombo',
      city: '',
      state: 'Bahia',
      coordinates: [-38.5016, -12.9714],
      description: '',
      history: '',
      heritageStatus: '',
      leader: '',
      founded: '',
      activities: [],
      imageUrl: 'https://images.unsplash.com/photo-1540206395-68808572332f?auto=format&fit=crop&q=80&w=600',
      contact: ''
    });
    
    setShowAddModal(false);
    triggerToast(`Território "${formattedTerritory.name}" adicionado ao rascunho com sucesso!`);
    handleSelectTerritory(formattedTerritory);
  };

  // Load custom territories from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('irun_custom_territories');
      if (saved) {
        setTerritories(JSON.parse(saved));
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do localStorage', err);
    }
  }, []);

  // Copy coordinates utility
  const handleCopyCoords = (coords: [number, number]) => {
    const text = `${coords[1]}, ${coords[0]}`;
    navigator.clipboard.writeText(text).then(() => {
      triggerToast('Coordenadas (Lat, Lng) copiadas para a área de transferência!');
    }).catch(() => {
      triggerToast('Erro ao copiar coordenadas.');
    });
  };

  return (
    <div id="mapa-container" className="relative w-screen h-screen overflow-hidden bg-slate-100 font-sans select-none">
      
      {/* 1. Main Background Vector Map */}
      <div id="map" ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* 2. Brand Floating Sidebar (Left Panel) */}
      <aside 
        id="panel-lateral"
        className="absolute top-4 left-4 z-10 w-96 max-h-[calc(100vh-2rem)] flex flex-col bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 overflow-hidden transition-all duration-300 lg:w-96 md:w-80 w-full sm:static sm:h-full mobile-drawer"
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white relative overflow-hidden">
          {/* Subtle light graphics */}
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <Compass className="w-48 h-48 rotate-12" />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold uppercase">
              Rascunho Consola
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleGeolocate}
                disabled={isLocating}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLocating 
                    ? 'bg-blue-600/30 text-blue-300 animate-pulse' 
                    : 'hover:bg-white/10 text-slate-300 hover:text-white'
                }`}
                title="Minha Localização"
              >
                <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={handleResetView}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Centralizar no Recôncavo"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight mt-2 flex items-center gap-2">
            MOVIMENTO IRUN
          </h1>
          <p className="text-xs text-slate-300 font-light tracking-wide mt-1">
            Identidade, Território e Ancestralidade no Recôncavo Baiano
          </p>
        </div>

        {/* Aggregate Stats Bar */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50/80 border-b border-slate-100 text-center py-2.5">
          <div>
            <span className="block text-xs font-semibold text-slate-800 font-display">{stats.total}</span>
            <span className="text-[9px] text-slate-500 font-medium uppercase">Locais</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-emerald-700 font-display">{stats.quilombos}</span>
            <span className="text-[9px] text-slate-500 font-medium uppercase">Quilombos</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-amber-700 font-display">{stats.cultura}</span>
            <span className="text-[9px] text-slate-500 font-medium uppercase">Cultura</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-sky-700 font-display">{stats.tradicional}</span>
            <span className="text-[9px] text-slate-500 font-medium uppercase">Outros</span>
          </div>
        </div>

        {/* Live Search and Hotkey Indicator */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative flex items-center bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all duration-200">
            <Search className="w-4.5 h-4.5 text-slate-400 mr-2 shrink-0" />
            <input 
              id="search-input"
              ref={searchInputRef}
              type="text" 
              placeholder="Buscar quilombo, cidade, saberes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm text-slate-800 placeholder-slate-400 font-normal"
              aria-label="Pesquisar no mapa"
            />
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-slate-200/60 text-slate-500 px-1.5 py-0.5 rounded border border-slate-300/30 select-none shrink-0">
              Ctrl+K
            </span>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="ml-1 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categorized Filter Tabs */}
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button 
            onClick={() => setActiveCategory('todos')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 ${
              activeCategory === 'todos' 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            Todos
          </button>
          <button 
            onClick={() => setActiveCategory('quilombo')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 flex items-center gap-1 ${
              activeCategory === 'quilombo' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white"></span>
            Quilombos
          </button>
          <button 
            onClick={() => setActiveCategory('cultura')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 flex items-center gap-1 ${
              activeCategory === 'cultura' 
                ? 'bg-amber-500 text-white shadow-sm' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 border border-white"></span>
            Cultura
          </button>
          <button 
            onClick={() => setActiveCategory('tradicional')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 flex items-center gap-1 ${
              activeCategory === 'tradicional' 
                ? 'bg-sky-500 text-white shadow-sm' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-sky-50 hover:text-sky-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 border border-white"></span>
            Tradicionais
          </button>
        </div>

        {/* Scrollable list of territories */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
          <AnimatePresence mode="popLayout">
            {filteredTerritories.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 px-4 text-center text-slate-400 flex flex-col items-center justify-center gap-2"
              >
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium">Nenhum território localizado</p>
                <p className="text-xs text-slate-400 max-w-xs">Tente redefinir a busca ou adicione um novo ponto ao mapa.</p>
              </motion.div>
            ) : (
              filteredTerritories.map((t) => {
                const isSelected = selectedTerritory?.id === t.id;
                return (
                  <motion.div
                    key={t.id}
                    layoutId={`card-${t.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleSelectTerritory(t)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 relative group overflow-hidden ${
                      isSelected 
                        ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300 shadow-md' 
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    {/* Visual marker left indicator */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                      t.category === 'quilombo' ? 'bg-emerald-500' : 
                      t.category === 'cultura' ? 'bg-amber-500' : 
                      'bg-sky-500'
                    }`} />

                    <div className="flex items-start justify-between gap-2 pl-1.5">
                      <h3 className="font-display font-bold text-sm text-slate-800 group-hover:text-slate-900 transition-colors">
                        {t.name}
                      </h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                        t.category === 'quilombo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        t.category === 'cultura' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-sky-50 text-sky-700 border border-sky-100'
                      }`}>
                        {t.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 pl-1.5 flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {t.city}, {t.state}
                    </p>

                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 pl-1.5 font-light leading-relaxed">
                      {t.description}
                    </p>

                    {/* Bottom stats/details indicator */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100/60 pl-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Fundado: {t.founded || 'Ancestral'}</span>
                      <span className="text-amber-700 group-hover:translate-x-1 transition-transform duration-200">
                        Ver detalhes →
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions: Add custom territory */}
        <div className="p-4 border-t border-slate-100 bg-white/95 flex gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-amber-950 text-white text-xs font-semibold transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 group shadow-lg"
          >
            <Plus className="w-4.5 h-4.5 group-hover:rotate-90 transition-transform duration-300" />
            Adicionar Território
          </button>
        </div>
      </aside>

      {/* 3. Floating Map Style Selector & Geolocation Controls (Top-Right) */}
      <div className="absolute top-4 right-16 z-10 flex gap-2 items-center bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/80 shadow-lg shrink-0">
        <button
          onClick={handleGeolocate}
          disabled={isLocating}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
            isLocating 
              ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' 
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:text-slate-900 shadow-sm'
          }`}
          title="Focar na minha localização atual"
        >
          <Locate className={`w-3.5 h-3.5 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />
          {isLocating ? 'Buscando...' : 'Minha Localização'}
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {(Object.keys(MAP_STYLES) as Array<keyof typeof MAP_STYLES>).map((styleKey) => (
          <button
            key={styleKey}
            onClick={() => setMapStyle(styleKey)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              mapStyle === styleKey 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {MAP_STYLES[styleKey].name}
          </button>
        ))}
      </div>

      {/* 4. Interactive Territory Detail Drawer (Floating Right Panel) */}
      <AnimatePresence>
        {selectedTerritory && (
          <motion.aside
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-4 right-4 z-10 w-96 max-h-[calc(100vh-2rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 flex flex-col overflow-hidden text-slate-800 lg:w-96 md:w-80 w-full"
          >
            {/* Image Banner Header */}
            <div className="h-44 relative bg-slate-200 overflow-hidden shrink-0">
              <img 
                src={selectedTerritory.imageUrl} 
                alt={selectedTerritory.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback image if unsplash fails
                  (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540206395-68808572332f?auto=format&fit=crop&q=80&w=600';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-5 text-white">
                <span className={`inline-block self-start text-[9px] font-mono tracking-widest px-2 py-0.5 rounded uppercase font-semibold mb-1 border ${
                  selectedTerritory.category === 'quilombo' ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300' :
                  selectedTerritory.category === 'cultura' ? 'bg-amber-600/30 border-amber-500/40 text-amber-300' :
                  'bg-sky-600/30 border-sky-500/40 text-sky-300'
                }`}>
                  {selectedTerritory.category}
                </span>
                <h2 className="text-lg font-display font-bold leading-tight">
                  {selectedTerritory.name}
                </h2>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setSelectedTerritory(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white hover:text-amber-400 transition-all shadow cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Detailed Sections */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Município</span>
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    {selectedTerritory.city}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Estado</span>
                  <span className="text-sm font-semibold text-slate-700 mt-0.5 block">
                    {selectedTerritory.state}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Liderança</span>
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    {selectedTerritory.leader || 'Tradicional'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Fundação</span>
                  <span className="text-sm font-semibold text-slate-700 mt-0.5 block font-display">
                    {selectedTerritory.founded || 'Ancestral'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  Visão Geral
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-light">
                  {selectedTerritory.description}
                </p>
              </div>

              {/* History / Origin */}
              <div className="space-y-1.5">
                <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                  Resistência Histórica
                </h3>
                <p className="text-xs text-slate-600 bg-amber-50/25 border-l-2 border-amber-600/50 pl-3 py-1 leading-relaxed font-light italic">
                  "{selectedTerritory.history}"
                </p>
              </div>

              {/* Heritage Status */}
              <div className="space-y-1.5">
                <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600 shrink-0" />
                  Status de Reconhecimento
                </h3>
                <div className="flex items-start gap-2 bg-emerald-50/40 border border-emerald-100 p-2.5 rounded-lg text-emerald-800 text-xs">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{selectedTerritory.heritageStatus}</span>
                </div>
              </div>

              {/* Key local Activities / Saberes */}
              <div className="space-y-2">
                <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  Atividades e Saberes locais
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTerritory.activities.map((act, idx) => (
                    <span 
                      key={idx} 
                      className="text-[10px] font-medium bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-full text-slate-600"
                    >
                      {act}
                    </span>
                  ))}
                </div>
              </div>

              {/* Coordinates block */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Lat, Lng: <span className="text-slate-800">{selectedTerritory.coordinates[1].toFixed(5)}, {selectedTerritory.coordinates[0].toFixed(5)}</span></span>
                <button 
                  onClick={() => handleCopyCoords(selectedTerritory.coordinates)}
                  className="p-1 text-slate-400 hover:text-amber-700 hover:bg-slate-200/50 rounded transition-all cursor-pointer"
                  title="Copiar Coordenadas"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
              {selectedTerritory.contact && (
                <a 
                  href={`mailto:${selectedTerritory.contact}`}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-4 h-4 text-slate-500" />
                  Falar com Coordenação
                </a>
              )}
              <button 
                onClick={() => handleCopyCoords(selectedTerritory.coordinates)}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all flex items-center justify-center gap-1"
                title="Compartilhar Coordenadas"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 5. Suggestions Overlay Notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white py-3.5 px-6 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-2 max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="text-xs font-normal">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Form Modal: Suggest / Add New Territory */}
      <AnimatePresence>
        {showAddModal && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-display font-bold">Cadastrar Novo Território</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Adicione um ponto ao rascunho interativo do Movimento Irun</p>
                </div>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setIsSelectingCoords(false);
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Scrollable */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                
                {/* Core Details Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nome do Território *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Quilombo Kaonge"
                      value={newTerritory.name}
                      onChange={(e) => setNewTerritory({...newTerritory, name: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Categoria *</label>
                    <select 
                      value={newTerritory.category}
                      onChange={(e) => setNewTerritory({...newTerritory, category: e.target.value as any})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    >
                      <option value="quilombo">Quilombo</option>
                      <option value="cultura">Cultura e Patrimônio</option>
                      <option value="tradicional">Comunidade Tradicional</option>
                    </select>
                  </div>
                </div>

                {/* Location row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Município *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Cachoeira"
                      value={newTerritory.city}
                      onChange={(e) => setNewTerritory({...newTerritory, city: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estado</label>
                    <input 
                      type="text" 
                      placeholder="Bahia"
                      value={newTerritory.state}
                      onChange={(e) => setNewTerritory({...newTerritory, state: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Coordinates & Capture tool */}
                <div className="space-y-1.5 p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Geolocalização (Longitude, Latitude) *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectingCoords(true);
                        setShowAddModal(false);
                        triggerToast('Clique em qualquer ponto do mapa para definir a geolocalização do território!');
                      }}
                      className="text-[10px] text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <MapIcon className="w-3 h-3" />
                      Capturar no Mapa
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-mono mr-2">Long:</span>
                      <input 
                        type="number" 
                        step="0.00001"
                        required
                        value={newTerritory.coordinates ? newTerritory.coordinates[0] : -38.50}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const lat = newTerritory.coordinates ? newTerritory.coordinates[1] : -12.97;
                          setNewTerritory({...newTerritory, coordinates: [val, lat]});
                        }}
                        className="w-full text-xs border-none outline-none font-mono text-slate-700"
                      />
                    </div>
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-mono mr-2">Lat:</span>
                      <input 
                        type="number" 
                        step="0.00001"
                        required
                        value={newTerritory.coordinates ? newTerritory.coordinates[1] : -12.97}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const lng = newTerritory.coordinates ? newTerritory.coordinates[0] : -38.50;
                          setNewTerritory({...newTerritory, coordinates: [lng, val]});
                        }}
                        className="w-full text-xs border-none outline-none font-mono text-slate-700"
                      />
                    </div>
                  </div>
                  {isSelectingCoords && (
                    <p className="text-[9px] text-amber-700 italic">Modo de seleção ativo. O formulário reabrirá automaticamente ao clicar.</p>
                  )}
                </div>

                {/* Short Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Breve Descrição *</label>
                  <textarea 
                    required
                    rows={2}
                    placeholder="Breve resumo da comunidade (atividades, localização, desafios)."
                    value={newTerritory.description}
                    onChange={(e) => setNewTerritory({...newTerritory, description: e.target.value})}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50 resize-none"
                  />
                </div>

                {/* Historical Narrative */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">História e Origem (Narrativa de Resistência)</label>
                  <textarea 
                    rows={2}
                    placeholder="Quais são as origens históricas, lutas ancestrais e vitórias dessa comunidade?"
                    value={newTerritory.history}
                    onChange={(e) => setNewTerritory({...newTerritory, history: e.target.value})}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50 resize-none"
                  />
                </div>

                {/* Additional metadata row (Leader, Foundation year) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Liderança / Representação</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Yalorixá Maria de Souza"
                      value={newTerritory.leader}
                      onChange={(e) => setNewTerritory({...newTerritory, leader: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Época de Fundação</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Meados do Século XVIII"
                      value={newTerritory.founded}
                      onChange={(e) => setNewTerritory({...newTerritory, founded: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Heritage and Image */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reconhecimento / Certificação</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Fundação Cultural Palmares (2012)"
                      value={newTerritory.heritageStatus}
                      onChange={(e) => setNewTerritory({...newTerritory, heritageStatus: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">URL da Imagem Ilustrativa</label>
                    <input 
                      type="url" 
                      placeholder="https://images.unsplash.com/..."
                      value={newTerritory.imageUrl}
                      onChange={(e) => setNewTerritory({...newTerritory, imageUrl: e.target.value})}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Activities / Saberes dynamic tagging */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saberes Tradicionais e Atividades</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ex: Samba de Roda"
                      value={newActivityInput}
                      onChange={(e) => setNewActivityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddActivity();
                        }
                      }}
                      className="flex-1 text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                    />
                    <button 
                      type="button"
                      onClick={handleAddActivity}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      Inserir
                    </button>
                  </div>
                  {newTerritory.activities && newTerritory.activities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      {newTerritory.activities.map((act, index) => (
                        <span 
                          key={index} 
                          className="text-[10px] font-medium bg-white border border-slate-200/80 pl-2 pr-1 py-1 rounded-md text-slate-600 flex items-center gap-1 group"
                        >
                          {act}
                          <button 
                            type="button"
                            onClick={() => handleRemoveActivity(act)}
                            className="text-slate-400 hover:text-red-500 rounded-full p-0.5 transition-colors cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coordination Contact Info */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-mail de Contato da Associação / Coordenação</label>
                  <input 
                    type="email" 
                    placeholder="associacao@quilombo.org"
                    value={newTerritory.contact}
                    onChange={(e) => setNewTerritory({...newTerritory, contact: e.target.value})}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-amber-600 bg-slate-50/50"
                  />
                </div>

              </form>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIsSelectingCoords(false);
                  }}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleFormSubmit}
                  className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-amber-950 text-white text-xs font-semibold cursor-pointer transition-all shadow-md flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Salvar Território
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Re-open coordinate picker modal helper overlay */}
      <AnimatePresence>
        {isSelectingCoords && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-900 py-3 px-6 rounded-full shadow-2xl border-2 border-white flex items-center gap-3 animate-bounce">
            <Compass className="w-5 h-5 animate-spin" />
            <span className="text-xs font-semibold">Clique no mapa para marcar a localização</span>
            <button 
              onClick={() => {
                setIsSelectingCoords(false);
                setShowAddModal(true);
              }}
              className="px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
