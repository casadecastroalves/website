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
  Locate,
  Video,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { territoriesData } from './data/territories';
import { Territory, FilterCategory } from './types';

// Map Styles mapping using reliable raster tile layers to prevent WebGL/CORS tile loading issues
const MAP_STYLES = {
  voyager: {
    name: 'Colorido (Voyager)',
    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO'
        }
      },
      layers: [{ id: 'raster-tiles-layer', type: 'raster', source: 'raster-tiles' }]
    }
  },
  positron: {
    name: 'Mínimo (Positron)',
    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO'
        }
      },
      layers: [{ id: 'raster-tiles-layer', type: 'raster', source: 'raster-tiles' }]
    }
  },
  satellite: {
    name: 'Satélite',
    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri'
        }
      },
      layers: [{ id: 'raster-tiles-layer', type: 'raster', source: 'raster-tiles' }]
    }
  }
};

export default function App() {
  // State variables
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('todos');
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('voyager');
  const [isLocating, setIsLocating] = useState(false);
  const [showCineIrun, setShowCineIrun] = useState(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [activeVideoCategory, setActiveVideoCategory] = useState<FilterCategory>('todos');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{src: string, caption: string} | null>(null);
  
  // Dynamic data loading
  useEffect(() => {
    async function loadData() {
      try {
        const manifestRes = await fetch('../territorios/data/manifest.json');
        const manifest = await manifestRes.json();
        
        // Load all fichas
        const fichasPromises = (manifest.fichas || []).map(async (id: string) => {
          try {
            const res = await fetch(`../territorios/data/fichas/${id}.json`);
            return await res.json();
          } catch (e) {
            console.error(`Failed to load ficha ${id}:`, e);
            return null;
          }
        });
        const loadedFichas = (await Promise.all(fichasPromises)).filter(Boolean);

        // Load all points files
        const pontosPromises = (manifest.pontos || []).map(async (id: string) => {
          try {
            const res = await fetch(`../territorios/data/pontos/${id}.json`);
            return await res.json();
          } catch (e) {
            console.error(`Failed to load pontos ${id}:`, e);
            return null;
          }
        });
        const loadedPontos = (await Promise.all(pontosPromises)).filter(Boolean);
        const allPins: any[] = [];
        loadedPontos.forEach((pf: any) => {
          if (pf && pf.pontos) {
            pf.pontos.forEach((p: any) => {
              allPins.push({ ...p, territorioId: p.territorioId || pf.territorioId });
            });
          }
        });
        
        // Map Fichas to Territory format for React layout
        const mapped: Territory[] = loadedFichas.map((f: any) => {
          // Find pins that point to this Ficha
          const matchingPins = allPins.filter((p: any) => (p.fichaId === f.id || p.entidadeId === f.id));
          // Extract YouTube videos from popup slides
          const videos: string[] = [];
          matchingPins.forEach((p: any) => {
            if (p.popup && p.popup.slides) {
              p.popup.slides.forEach((s: any) => {
                if (s.video && s.video.tipo === 'youtube' && s.video.id) {
                  videos.push(s.video.id);
                }
              });
            }
          });

          const historySection = f.sidebar?.identidade?.find((i: any) => i.id === 'historia')?.conteudo || '';
          const heritageStatus = f.sidebar?.identidade?.find((i: any) => i.id === 'patrimonio')?.conteudo || 'Certificado';
          
          const tiMapping: Record<string, string> = {
            "ti-01": "Irecê", "ti-02": "Velho Chico", "ti-03": "Chapada Diamantina", "ti-04": "Sisal", "ti-05": "Litoral Sul", "ti-06": "Baixo Sul", "ti-07": "Extremo Sul", "ti-08": "Médio Sudoeste da Bahia", "ti-09": "Vale do Jiquiriçá", "ti-10": "Sertão do São Francisco", "ti-11": "Bacia do Rio Grande", "ti-12": "Bacia do Paramirim", "ti-13": "Sertão Produtivo", "ti-14": "Piemonte do Paraguaçu", "ti-15": "Bacia do Jacuípe", "ti-16": "Piemonte da Diamantina", "ti-17": "Semiárido Nordeste II", "ti-18": "Litoral Norte e Agreste Baiano", "ti-19": "Portal do Sertão", "ti-20": "Sudoeste Baiano", "ti-21": "Recôncavo", "ti-22": "Médio Rio de Contas", "ti-23": "Bacia do Rio Corrente", "ti-24": "Itaparica", "ti-25": "Piemonte Norte do Itapicuru", "ti-26": "RMS — Região Metropolitana de Salvador", "ti-27": "Costa do Descobrimento"
          };
          const tiName = tiMapping[f.territorioId] || f.territorioId || 'Bahia';

          return {
            id: f.id,
            name: f.meta?.nome || f.titulo || f.id,
            category: f.tipo || 'comunidade tradicional',
            coordinates: [f.meta?.coords[1], f.meta?.coords[0]] as [number, number], // [lng, lat]
            city: f.meta?.municipio || '',
            state: tiName,
            description: f.sidebar?.apresentacao || '',
            history: historySection,
            heritageStatus: heritageStatus,
            activities: [],
            imageUrl: f.sidebar?.fotos?.[0]?.src 
              ? `../territorios/${f.sidebar.fotos[0].src}`
              : 'https://images.unsplash.com/photo-1540206395-68808572332f?auto=format&fit=crop&q=80&w=600',
            contact: f.meta?.responsavel || '',
            rawFicha: { ...f, videos } // Attach matching video IDs here!
          };
        });
        
        setTerritories(mapped);
      } catch (err) {
        console.error('Failed to load dynamic map data:', err);
      }
    }
    loadData();
  }, []);

  // Modals and notifications
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSelectingCoords, setIsSelectingCoords] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
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

  // Statistics calculation removed as requested

  // Filtered list based on active category and search text
  const filteredTerritories = useMemo(() => {
    return territories.filter(t => {
      let matchesCategory = false;
      if (activeCategory === 'todos') {
        matchesCategory = true;
      } else if (activeCategory === 'Teia dos Povos') {
        matchesCategory = t.rawFicha?.teiaDosPovos === true;
      } else if (activeCategory === 'Ponto de Cultura') {
        matchesCategory = t.rawFicha?.pontoDeCultura === true;
      } else if (activeCategory === 'Rede Irun') {
        matchesCategory = t.rawFicha?.rede === true;
      } else {
        matchesCategory = t.category === activeCategory;
      }

      const matchesSearch = 
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.leader && t.leader.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.activities || []).some(act => act.toLowerCase().includes(searchQuery.toLowerCase()));
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
      style: MAP_STYLES[mapStyle].style as any,
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



    return () => {
      map.remove();
    };
  }, []);

  // Sync map style when state changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[mapStyle].style as any);
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
      let bgColor = 'bg-sky-500';
      let ringColor = 'ring-sky-200';
      
      if (t.category === 'quilombo' || t.category === 'natureza' || t.category === 'producao') {
        bgColor = 'bg-emerald-600'; ringColor = 'ring-emerald-200';
      } else if (t.category === 'cultura' || t.category === 'turismo' || t.category === 'terreiro') {
        bgColor = 'bg-amber-500'; ringColor = 'ring-amber-200';
      } else if (t.category === 'instituicao' || t.category === 'assentamento') {
        bgColor = 'bg-slate-700'; ringColor = 'ring-slate-300';
      }

      el.className = `flex items-center justify-center rounded-full text-white cursor-pointer shadow-xl border border-white/60 ${bgColor} ${
        isSelected ? 'w-10 h-10 ring-4 ' + ringColor + ' z-30' : 'w-8 h-8 hover:z-20'
      }`;

      // Custom marker inner SVG with safe scale transitions on hover/select
      el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 transition-transform duration-300 hover:scale-120 ${isSelected ? 'marker-pulse scale-110' : ''}">
          <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
        </svg>
      `;

      // Set up simple click callback on marker
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSelectTerritory(t);
      });

      // MapLibre popup on hover (brief summary without photo)
      const popup = new maplibregl.Popup({
        offset: 15,
        closeButton: false,
        closeOnClick: false
      }).setHTML(`
        <div class="text-[11px] p-1.5 max-w-[190px] font-sans leading-normal text-center">
          <p class="font-bold text-slate-900 leading-tight">${t.name}</p>
          <p class="text-slate-500 mt-0.5">${t.city}</p>
          <span class="inline-block mt-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-700">Clique para ver</span>
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
    setIsSidebarOpen(true);
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
    setSearchQuery('');
    setActiveCategory('todos');
    setIsSidebarOpen(true);
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

  // Get all unique videos mapped from territories data
  const allVideos = useMemo(() => {
    const list: any[] = [];
    territories.forEach(t => {
      if (t.rawFicha?.videos) {
        t.rawFicha.videos.forEach((vidId: string) => {
          // Prevent duplicates
          if (!list.some(v => v.id === vidId)) {
            list.push({
              id: vidId,
              title: t.name,
              territory: t,
              category: t.category,
              city: t.city
            });
          }
        });
      }
    });
    return list;
  }, [territories]);

  // Filter videos based on search
  const filteredVideos = useMemo(() => {
    return allVideos.filter(v => {
      const matchSearch = (v.title || '').toLowerCase().includes((videoSearchQuery || '').toLowerCase()) || 
                          (v.city || '').toLowerCase().includes((videoSearchQuery || '').toLowerCase());
      const matchCategory = activeVideoCategory === 'todos' || v.category === activeVideoCategory;
      return matchSearch && matchCategory;
    });
  }, [allVideos, videoSearchQuery, activeVideoCategory]);

  const stats = useMemo(() => {
    const s = { total: filteredTerritories.length, quilombos: 0, cultura: 0, tradicional: 0 };
    filteredTerritories.forEach(t => {
      if (t.category === 'quilombo') s.quilombos++;
      else if (t.category === 'cultura' || t.category === 'terreiro') s.cultura++;
      else s.tradicional++;
    });
    return s;
  }, [filteredTerritories]);

  return (
    <div id="mapa-container" className="relative w-screen h-screen overflow-hidden bg-slate-100 font-sans select-none">
      
      {/* 1. Main Background Vector Map */}
      <div id="map" ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* 2. Brand Floating Sidebar (Left Panel) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            id="panel-lateral"
            className="absolute top-4 left-4 z-10 w-[calc(100%-2rem)] md:w-80 lg:w-96 max-h-[calc(100vh-2rem)] flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 overflow-hidden"
          >
            {/* Brand Header */}
            <div className="p-4 pb-4 border-b border-slate-100 bg-white/95 relative flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h1 
                  onClick={handleResetView}
                  className="text-[1.35rem] font-display font-bold tracking-tight text-slate-900 cursor-pointer hover:text-amber-800 transition-colors leading-none"
                >
                  MOVIMENTO IRUN
                </h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wider mt-1.5 uppercase">
                  IDENTIDADE E TERRITÓRIO
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={handleResetView}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Centralizar no Recôncavo"
                >
                  <Compass className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors cursor-pointer shadow-sm"
                  title="Ocultar painel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

        {/* Aggregate Stats Bar Removed as per user request */}

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
          {['Teia dos Povos', 'Ponto de Cultura', 'Rede Irun'].map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 flex items-center gap-1 ${
                activeCategory === cat
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full border border-white ${activeCategory === cat ? 'bg-amber-400' : 'bg-slate-300'}`}></span>
              {cat}
            </button>
          ))}
        </div>

        {/* Scrollable list of territories */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
          {/* About Map Card (Visible only when no territory is selected and no active search) */}
          {!selectedTerritory && searchQuery === '' && activeCategory === 'todos' && (
            <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm text-xs text-slate-600 leading-relaxed font-light space-y-2.5">
              <h3 className="font-display font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Map className="w-4 h-4 text-slate-500 shrink-0" />
                Sobre o Mapa Identidade e Território
              </h3>
              <p>
                Sejam bem-vindos ao Mapa Identidade e Território, construído coletivamente com as comunidades mapeadas pelo Projeto Movimento Irun.
              </p>
              <p>
                Este mapa é resultado do Programa Design Dialógico (2017) e dos cursos do Programa Bem Viver (2026), a partir do curso Design de Território — centrado em visão participativa, identidade territorial e narrativas de futuro. Por meio desse processo, foram mapeadas as comunidades quilombolas de Lagoa Grande, Tenodé e Engenho da Ponte, em parceria com a Teia dos Povos.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                <strong className="block font-semibold text-slate-800 mb-1">Autoria e Realização</strong>
                <span className="text-slate-600 block mb-2">Projeto Movimento Irun, sob a coordenação geral da Casa de Castro Alves, com mapeamento colaborativo pelas comunidades locais, parceiros e alunos.</span>
                <strong className="block font-semibold text-slate-800 mb-1 mt-2">Os 27 Territórios de Identidade</strong>
                A demarcação segue critérios ambientais, econômicos e culturais que expressam identidade, coesão social e pertencimento territorial.
              </div>
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <a 
                  href="https://casadecastroalves.com.br/movimento-irun/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-[10px]"
                >
                  🔗 Movimento Irun · Cursos
                </a>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 font-mono leading-normal">
                O projeto Movimento Irun foi contemplado nos editais da Política Nacional Aldir Blanc Bahia e tem apoio financeiro do Governo do Estado da Bahia, por meio da Secretaria de Cultura do Estado da Bahia via PNAB, direcionada pelo Ministério da Cultura - Governo Federal. A iniciativa é também contemplada pela Política Nacional Cultura Viva.
              </p>
            </div>
          )}
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
                      {t.founded && <span>Fundado: {t.founded}</span>}
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
        <div className="p-4 border-t border-slate-100 bg-white/95 flex gap-2 shrink-0">
          <button 
            onClick={() => setShowCineIrun(true)}
            className="flex-1 py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
          >
            <Video className="w-4 h-4" />
            Cine Irun
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all duration-300 cursor-pointer flex items-center justify-center gap-1 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Novo Ponto
          </button>
        </div>
          </motion.aside>
        )}

        {!isSidebarOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-10 px-4 py-3 bg-white/90 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl text-slate-800 hover:text-amber-700 hover:shadow-amber-500/10 transition-all flex items-center gap-3 group"
          >
            <Layers className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="font-display font-bold tracking-tight text-sm">MOVIMENTO IRUN</span>
          </motion.button>
        )}
      </AnimatePresence>
      {/* 3. Floating Map Style Selector & Geolocation Controls (Top-Right on desktop, Bottom on mobile) */}
      <AnimatePresence>
        {!selectedTerritory && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-auto md:top-4 md:right-16 md:left-auto md:translate-x-0 z-10 flex gap-1.5 items-center bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/80 shadow-lg max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none shrink-0"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Interactive Territory Detail Drawer (Floating Right Panel) */}
      <AnimatePresence>
        {selectedTerritory && (
          <>
            {/* Backdrop for Netflix style focus */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTerritory(null)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] cursor-pointer"
            />
            <motion.aside
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full md:w-[420px] lg:w-[480px] bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden text-slate-800"
            >
            {/* Mobile Pull Handle bar */}
            <div 
              className="w-12 h-1.5 bg-slate-300 hover:bg-slate-400 transition-colors rounded-full mx-auto my-3 md:hidden block shrink-0 cursor-pointer" 
              onClick={() => setSelectedTerritory(null)} 
            />
            {/* Clean Light Text Header */}
            <div className="p-5 border-b border-slate-100 bg-white relative flex flex-col justify-end shrink-0 pr-12">
              <span className={`inline-block self-start text-[9px] font-mono tracking-widest px-2 py-0.5 rounded uppercase font-semibold mb-1.5 border bg-slate-50 border-slate-200 text-slate-600`}>
                {selectedTerritory.category}
              </span>
              <h2 className="text-lg md:text-xl font-display font-bold leading-tight text-slate-900">
                {selectedTerritory.name}
              </h2>

              {/* Close Button */}
              <button 
                onClick={() => setSelectedTerritory(null)}
                className="absolute top-4 right-4 p-2 md:p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer z-10"
              >
                <X className="w-5 h-5 md:w-4 md:h-4" />
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
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">TI (Código)</span>
                  <span className="text-sm font-semibold text-slate-700 mt-0.5 block uppercase">
                    {selectedTerritory.state}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Representação</span>
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    {selectedTerritory.rawFicha?.meta?.responsavel || selectedTerritory.leader || 'Comunidade'}
                  </span>
                </div>
              </div>

              {/* Photo Gallery (Carousel) */}
              {selectedTerritory.rawFicha?.sidebar?.fotos && selectedTerritory.rawFicha.sidebar.fotos.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                    Galeria de Fotos
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 pt-1 snap-x scrollbar-thin">
                    {selectedTerritory.rawFicha?.sidebar?.fotos?.map((photo: any, index: number) => (
                      <div 
                        key={index} 
                        className="snap-center shrink-0 w-72 h-44 relative rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer group hover:border-amber-400 transition-colors"
                        onClick={() => setFullscreenImage({ src: `../territorios/${photo.src}`, caption: photo.legenda })}
                      >
                        <img 
                          src={`../territorios/${photo.src}`} 
                          alt={photo.legenda} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-[10px] p-3 font-light truncate">
                          {photo.legenda}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  Visão Geral
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-light">
                  {selectedTerritory.description}
                </p>
              </div>

              {/* YouTube Video Slides */}
              {selectedTerritory.rawFicha?.videos && selectedTerritory.rawFicha.videos.length > 0 && (
                <div className="space-y-3.5">
                  <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    Mídias e Vídeos
                  </h3>
                  <div className="space-y-3">
                    {selectedTerritory.rawFicha?.videos?.map((vidId: string, idx: number) => (
                      <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-md">
                        <iframe
                          className="absolute inset-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${vidId}?rel=0&modestbranding=1&playsinline=1`}
                          title="Vídeo do Território"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible/Accordion Identity Sections */}
              {selectedTerritory.rawFicha?.sidebar?.identidade && selectedTerritory.rawFicha.sidebar.identidade.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                    Identidade Territorial
                  </h3>
                  <div className="space-y-2">
                    {selectedTerritory.rawFicha?.sidebar?.identidade?.map((item: any, idx: number) => (
                      <div key={idx} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                        <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {item.titulo}
                        </h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-light">
                          {item.conteudo}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products and Production */}
              {selectedTerritory.rawFicha?.sidebar?.produtos && selectedTerritory.rawFicha.sidebar.produtos.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    Produção e Produtos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTerritory.rawFicha?.sidebar?.produtos?.map((prod: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <h4 className="text-xs font-semibold text-slate-800">{prod.nome}</h4>
                        {prod.descricao && (
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-light">
                            {prod.descricao}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents & PDFs */}
              {selectedTerritory.rawFicha?.sidebar?.documentos && selectedTerritory.rawFicha.sidebar.documentos.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-display font-semibold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600 shrink-0" />
                    Documentos e Cartografia
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedTerritory.rawFicha?.sidebar?.documentos?.map((doc: any, idx: number) => (
                      <a
                        key={idx}
                        href={`../territorios/${doc.src}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all text-xs text-slate-700 font-medium"
                      >
                        <span className="truncate pr-4">{doc.legenda || 'Ver PDF'}</span>
                        <span className="text-[10px] text-amber-700 font-semibold shrink-0">Baixar PDF →</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Coordinates block */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Lat, Lng: <span className="text-slate-800">{selectedTerritory.coordinates[1].toFixed(5)}, {selectedTerritory.coordinates[0].toFixed(5)}</span></span>
                <button 
                  onClick={() => handleCopyCoords(selectedTerritory.coordinates)}
                  className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-slate-200/50 rounded-lg transition-all cursor-pointer"
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
                  Contato
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
          </>
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
      {/* 7. Cine Irun (Netflix-style video library) Overlay Modal */}
      <AnimatePresence>
        {showCineIrun && (
          <div className="fixed inset-0 z-50 bg-[#141414] flex flex-col overflow-hidden text-white font-sans">
            {/* Modal Header */}
            <div className="px-6 py-6 md:px-12 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 bg-[#141414]">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-black tracking-tighter text-[#E50914] flex items-center gap-3">
                  CINE IRUN 
                </h2>
                <p className="text-sm text-gray-400 font-light mt-1.5">
                  Acervo de documentários e saberes.
                </p>
              </div>

              {/* Video Search and Filter pills */}
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex items-center bg-black/60 border border-white/20 focus-within:border-white focus-within:bg-black rounded px-4 py-2.5 w-full md:w-80 transition-all">
                  <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={videoSearchQuery}
                    onChange={(e) => setVideoSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none w-full text-sm text-white placeholder-gray-500 font-light"
                  />
                  {videoSearchQuery && (
                    <button onClick={() => setVideoSearchQuery('')} className="ml-2 text-gray-400 hover:text-white cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    setShowCineIrun(false);
                    setVideoSearchQuery('');
                    setPlayingVideo(null);
                  }}
                  className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Fechar Cine Irun"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Video Category Filter Tabs */}
            <div className="px-6 md:px-12 flex gap-6 overflow-x-auto scrollbar-none shrink-0 mb-4">
              <button 
                onClick={() => setActiveVideoCategory('todos')}
                className={`pb-2 text-sm md:text-base font-medium transition-all shrink-0 cursor-pointer ${
                  activeVideoCategory === 'todos' ? 'text-white border-b-2 border-[#E50914]' : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                }`}
              >
                Todos
              </button>
              {Array.from(new Set(allVideos.map(v => v.category))).filter(Boolean).sort().map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveVideoCategory(cat)}
                  className={`pb-2 text-sm md:text-base font-medium transition-all shrink-0 cursor-pointer capitalize ${
                    activeVideoCategory === cat ? 'text-white border-b-2 border-[#E50914]' : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Videos Grid */}
            <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-12 scrollbar-thin">
              {filteredVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-2">
                  <AlertCircle className="w-10 h-10 text-gray-600 animate-pulse" />
                  <p className="text-sm font-semibold">Nenhum vídeo localizado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-10">
                  {filteredVideos.map((video: any, index: number) => (
                    <div key={index} className="group rounded-md overflow-hidden bg-[#181818] transition-all duration-300 hover:scale-105 hover:z-10 hover:shadow-2xl hover:shadow-black/80 cursor-pointer flex flex-col relative">
                      {/* Video Player Embed (Lazy loaded) */}
                      <div className="relative aspect-video bg-[#141414] overflow-hidden shrink-0 group/vid" onClick={() => setPlayingVideo(video.id)}>
                        {playingVideo === video.id ? (
                          <iframe
                            className="absolute inset-0 w-full h-full"
                            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                            title={video.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <>
                            <img 
                              src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`} 
                              alt="Thumbnail" 
                              className="w-full h-full object-cover opacity-90 group-hover/vid:opacity-100 transition-opacity duration-300" 
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 bg-black/30 transition-all duration-300">
                              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/50 group-hover/vid:bg-[#E50914] group-hover/vid:border-transparent transition-all duration-300">
                                <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Info Footer on Card */}
                      <div 
                        className="p-3 flex-1 flex flex-col justify-between gap-2"
                        onClick={() => {
                          if (playingVideo === video.id) return;
                          handleSelectTerritory(video.territory);
                          setShowCineIrun(false);
                          setPlayingVideo(null);
                        }}
                      >
                        <div>
                          <h4 className="font-semibold text-sm text-white leading-snug line-clamp-2">
                            {video.title}
                          </h4>
                          <p className="text-[11px] text-gray-400 font-light mt-1 flex items-center gap-1.5">
                            <span className="truncate">{video.city}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest border border-gray-600 px-1 rounded-sm">
                            {video.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. Fullscreen Image Lightbox */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setFullscreenImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all shadow-xl"
              onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
              <img 
                src={fullscreenImage.src} 
                alt={fullscreenImage.caption}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              {fullscreenImage.caption && (
                <p className="text-white text-sm md:text-base font-light mt-4 text-center">
                  {fullscreenImage.caption}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
