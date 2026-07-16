import React, { useState, useEffect, useRef } from 'react';
import { 
  Network, 
  Smartphone, 
  Database, 
  PlusCircle, 
  Trash2, 
  RefreshCw, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Shield, 
  Zap, 
  Terminal, 
  Info,
  Copy,
  Plus,
  Wifi,
  WifiOff,
  Activity,
  Edit2,
  X,
  Laptop,
  Download,
  Upload,
  Settings
} from 'lucide-react';

declare global {
  interface Window {
    Peer: any;
  }
}

interface Ticket {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  user: string;
  createdAt: string;
  version: number;
  lastUpdatedBy: string;
}

interface Connection {
  peerId: string;
  name: string;
  connInstance: any;
}

interface LogItem {
  id: number;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'sync';
  message: string;
}

type DeviceMode = 'central' | 'terminal';

const LOCAL_STORAGE_KEY = 'meshdesk_p2p_tickets';
const NODE_NAME_KEY = 'meshdesk_node_name';
const SAVED_PEER_ID_KEY = 'meshdesk_stable_peer_id';
const DEVICE_MODE_KEY = 'meshdesk_device_mode';
const SAVED_CENTRAL_ID_KEY = 'meshdesk_target_central_id';

const generateUniqueId = (): string => Math.random().toString(36).substring(2, 9).toUpperCase();

const PHONE_MODELS: string[] = [
  'Servidor Desktop', 'Estação de TI', 'Galaxy S24', 'iPhone 15', 'Xiaomi Note', 'ThinkPad Terminal'
];

export default function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('central');
  const [myNodeId, setMyNodeId] = useState<string>('');
  const [myNodeName, setMyNodeName] = useState<string>('');
  const [peerInstance, setPeerInstance] = useState<any>(null);
  
  const [connections, setConnections] = useState<Connection[]>([]);
  const [targetPeerId, setTargetPeerId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('initializing'); // initializing, ready, connected, error
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [tempNodeName, setTempNodeName] = useState<string>('');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [centralServerIdInput, setCentralServerIdInput] = useState<string>('');

  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Rede');
  const [newPriority, setNewPriority] = useState<string>('media');
  const [newUser, setNewUser] = useState<string>('');

  const [filterCategory, setFilterCategory] = useState<string>('Todos');
  const [filterPriority, setFilterPriority] = useState<string>('Todos');

  const [copiedId, setCopiedId] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Carrega Modo do Dispositivo (Padrão: Central para o computador de 8 horas)
    const storedMode = localStorage.getItem(DEVICE_MODE_KEY) as DeviceMode;
    if (storedMode) {
      setDeviceMode(storedMode);
    } else {
      localStorage.setItem(DEVICE_MODE_KEY, 'central');
      setDeviceMode('central');
    }

    // 2. Carrega ou define o nome amigável do computador/celular
    let storedName = localStorage.getItem(NODE_NAME_KEY);
    if (!storedName) {
      const isDesktop = !/Android|iPhone/i.test(navigator.userAgent);
      const defaultName = isDesktop ? `Computador Central (TI)` : `${PHONE_MODELS[Math.floor(Math.random() * PHONE_MODELS.length)]}`;
      storedName = defaultName;
      localStorage.setItem(NODE_NAME_KEY, defaultName);
    }
    setMyNodeName(storedName);
    setTempNodeName(storedName);

    // 3. Carrega o ID do Servidor Central Salvo (Caso este dispositivo seja um terminal de campo)
    const savedCentralId = localStorage.getItem(SAVED_CENTRAL_ID_KEY);
    if (savedCentralId) {
      setCentralServerIdInput(savedCentralId);
    }

    // 4. Carrega os chamados salvos localmente
    const storedTickets = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedTickets) {
      try {
        setTickets(JSON.parse(storedTickets));
        addLog('Banco de dados local carregado. Registros preservados pós-reinício.', 'success');
      } catch (e) {
        addLog('Erro ao ler banco local. Inicializando base limpa.', 'error');
      }
    } else {
      const initial: Ticket[] = [
        { id: '1', title: 'Falha de comunicação com Switch de Borda', category: 'Rede', priority: 'alta', status: 'pendente', user: 'Central de Operações', createdAt: new Date(Date.now() - 3600000).toISOString(), version: 1, lastUpdatedBy: storedName }
      ];
      setTickets(initial);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
    }

    addLog('Mecanismo de persistência em disco rígido ativado com sucesso.', 'info');
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const saveToLocalStorage = (newTickets: Ticket[]) => {
    setTickets(newTickets);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTickets));
  };

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' | 'sync' = 'info') => {
    setLogs(prev => [
      ...prev,
      { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), type, message }
    ].slice(-40));
  };

  useEffect(() => {
    let active = true;

    const loadAndInitPeer = async () => {
      addLog('Carregando biblioteca de enlace P2P (WebRTC)...', 'info');
      
      if (window.Peer) {
        if (active) initPeerInstance();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
      script.async = true;
      script.onload = () => {
        if (active) {
          addLog('Biblioteca carregada. Verificando persistência de ID...', 'success');
          initPeerInstance();
        }
      };
      script.onerror = () => {
        if (active) {
          setConnectionStatus('error');
          addLog('Erro ao carregar módulo P2P. Verifique sua conexão com a rede local.', 'error');
        }
      };
      document.head.appendChild(script);
    };

    loadAndInitPeer();

    return () => {
      active = false;
    };
  }, [deviceMode]); 

  const initPeerInstance = () => {
    try {
      let stableId = localStorage.getItem(SAVED_PEER_ID_KEY);
      
      if (!stableId) {
        const prefix = deviceMode === 'central' ? 'MESHDESK-SERVER-' : 'MESHDESK-TERM-';
        stableId = prefix + generateUniqueId();
        localStorage.setItem(SAVED_PEER_ID_KEY, stableId);
      }

      const peer = new window.Peer(stableId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('open', (id: string) => {
        setMyNodeId(id);
        setConnectionStatus('ready');
        addLog(`Endereço estático registrado na rede: ${id}`, 'success');
        addLog('Pronto para receber ou disparar sincronizações na malha.', 'info');
      });

      peer.on('connection', (conn: any) => {
        setupConnection(conn);
      });

      peer.on('error', (err: any) => {
        console.error('PeerJS Error:', err);
        addLog(`Alerta do sistema de sinalização: ${err.message}`, 'warning');
        
        if (err.type === 'unavailable-id') {
          addLog('Este ID já está em uso na rede. Tentando forçar reinicialização...', 'info');
        }
      });

      setPeerInstance(peer);
    } catch (e: any) {
      setConnectionStatus('error');
      addLog(`Falha na inicialização do subsistema de rede: ${e.message}`, 'error');
    }
  };

  const setupConnection = (conn: any) => {
    setConnectionStatus('connected');
    
    conn.on('open', () => {
      addLog(`Túnel de dados direto estabelecido com [${conn.peer.slice(-6)}].`, 'success');
      
      conn.send({
        type: 'HANDSHAKE',
        nodeName: myNodeName,
        tickets: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]')
      });
    });

    conn.on('data', (data: any) => {
      if (!data || !data.type) return;

      if (data.type === 'HANDSHAKE') {
        setConnections(prev => {
          const exists = prev.some(c => c.peerId === conn.peer);
          if (exists) return prev;
          return [...prev, { peerId: conn.peer, name: data.nodeName, connInstance: conn }];
        });
        addLog(`Dispositivo de campo pareado: ${data.nodeName}`, 'success');
        mergeTickets(data.tickets, data.nodeName);
      }

      if (data.type === 'SYNC_DATA') {
        mergeTickets(data.tickets, data.nodeName);
      }

      if (data.type === 'TICKET_UPDATE') {
        mergeTickets([data.ticket], data.nodeName);
      }
    });

    conn.on('close', () => {
      addLog(`Dispositivo remoto desconectou-se.`, 'warning');
      setConnections(prev => prev.filter(c => c.peerId !== conn.peer));
    });

    conn.on('error', () => {
      addLog(`Interrupção abrupta no link de comunicação.`, 'warning');
      setConnections(prev => prev.filter(c => c.peerId !== conn.peer));
    });
  };

  useEffect(() => {
    if (deviceMode !== 'terminal' || !centralServerIdInput.trim() || connections.length > 0 || !peerInstance) return;

    const autoReconnectInterval = setInterval(() => {
      addLog(`[Auto-Reconexão] Buscando Servidor Central no ID: ${centralServerIdInput}...`, 'info');
      try {
        const conn = peerInstance.connect(centralServerIdInput.trim());
        setupConnection(conn);
      } catch (err) {
        console.log('Tentativa de reconexão automática falhou. Aguardando próximo ciclo.');
      }
    }, 15000);

    return () => clearInterval(autoReconnectInterval);
  }, [deviceMode, centralServerIdInput, connections, peerInstance]);

  const connectToDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPeerId.trim() || !peerInstance) return;

    const cleanTargetId = targetPeerId.trim();

    if (cleanTargetId === myNodeId) {
      addLog('Não é possível estabelecer conexão consigo mesmo!', 'error');
      return;
    }

    addLog(`Iniciando handshake WebRTC com: ${cleanTargetId}...`, 'info');
    try {
      const conn = peerInstance.connect(cleanTargetId);
      setupConnection(conn);
    } catch (err: any) {
      addLog(`Falha ao conectar: ${err.message}`, 'error');
    }
    setTargetPeerId('');
  };

  const mergeTickets = (incomingTickets: Ticket[], remoteNodeName: string) => {
    const localTickets: Ticket[] = [...JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]')];
    let hasChanges = false;

    incomingTickets.forEach(incoming => {
      if (deviceMode === 'terminal' && incoming.status === 'concluido') {
        const matchIndex = localTickets.findIndex(l => l.id === incoming.id);
        if (matchIndex !== -1) {
          localTickets.splice(matchIndex, 1);
          hasChanges = true;
          addLog(`Chamado #${incoming.id.slice(-4)} concluído remotamente e removido deste terminal de campo.`, 'sync');
        }
        return; 
      }

      const localMatchIndex = localTickets.findIndex(l => l.id === incoming.id);

      if (localMatchIndex === -1) {
        localTickets.push(incoming);
        hasChanges = true;
        addLog(`Novo chamado recebido de [${remoteNodeName}]: "${incoming.title}"`, 'sync');
      } else {
        const local = localTickets[localMatchIndex];
        if (incoming.version > local.version) {
          localTickets[localMatchIndex] = incoming;
          hasChanges = true;
          addLog(`Atualização aceita para #${incoming.id.slice(-4)} (v${incoming.version}) de [${remoteNodeName}]`, 'sync');
        } else if (local.version > incoming.version) {
          broadcastMyData();
        }
      }
    });

    if (hasChanges) {
      localTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveToLocalStorage(localTickets);
    }
  };

  const broadcastMyData = () => {
    const currentLocalTickets: Ticket[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    connections.forEach(c => {
      if (c.connInstance && c.connInstance.open) {
        c.connInstance.send({
          type: 'SYNC_DATA',
          nodeName: myNodeName,
          tickets: currentLocalTickets
        });
      }
    });
  };

  const broadcastSingleUpdate = (ticket: Ticket) => {
    connections.forEach(c => {
      if (c.connInstance && c.connInstance.open) {
        c.connInstance.send({
          type: 'TICKET_UPDATE',
          nodeName: myNodeName,
          ticket: ticket
        });
      }
    });
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUser.trim()) return;

    const newTicket: Ticket = {
      id: generateUniqueId(),
      title: newTitle,
      category: newCategory,
      priority: newPriority,
      status: 'pendente',
      user: newUser,
      createdAt: new Date().toISOString(),
      version: 1,
      lastUpdatedBy: myNodeName
    };

    const updated = [newTicket, ...tickets];
    saveToLocalStorage(updated);
    addLog(`Registro #${newTicket.id} salvo de forma segura no disco rígido.`, 'success');

    broadcastSingleUpdate(newTicket);

    setNewTitle('');
    setNewUser('');
  };

  const updateTicketStatus = (ticketId: string, nextStatus: string) => {
    let updatedTicket: Ticket | null = null;
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (!ticketToUpdate) return;

    updatedTicket = {
      ...ticketToUpdate,
      status: nextStatus,
      version: ticketToUpdate.version + 1,
      lastUpdatedBy: myNodeName
    };

    if (updatedTicket) {
      broadcastSingleUpdate(updatedTicket);
    }

    let updated: Ticket[];
    
    if (deviceMode === 'terminal' && nextStatus === 'concluido') {
      updated = tickets.filter((t: Ticket) => t.id !== ticketId);
      addLog(`Chamado #${ticketId.slice(-4)} concluído e removido deste terminal de campo.`, 'info');
    } else {
      updated = tickets.map((t: Ticket) => {
        if (t.id === ticketId) {
          return updatedTicket!;
        }
        return t;
      });
      addLog(`Chamado #${ticketId.slice(-4)} atualizado para [${nextStatus}].`, 'info');
    }

    saveToLocalStorage(updated);
  };

  const deleteTicket = (ticketId: string) => {
    const updated = tickets.filter((t: Ticket) => t.id !== ticketId);
    saveToLocalStorage(updated);
    addLog(`Chamado #${ticketId.slice(-4)} apagado localmente.`, 'warning');
    broadcastMyData();
  };

  const handleExportBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tickets, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `meshdesk_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      addLog('Arquivo de backup JSON gerado e baixado com sucesso.', 'success');
    } catch (e: any) {
      addLog(`Falha ao exportar banco de dados: ${e.message}`, 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsedData)) {
            saveToLocalStorage(parsedData);
            addLog(`Backup restaurado! ${parsedData.length} registros importados com sucesso.`, 'success');
            broadcastMyData();
          } else {
            addLog('Arquivo de backup inválido ou corrompido.', 'error');
          }
        } catch (err) {
          addLog('Erro ao analisar arquivo de backup JSON.', 'error');
        }
      };
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(DEVICE_MODE_KEY, deviceMode);
    localStorage.setItem(SAVED_CENTRAL_ID_KEY, centralServerIdInput.trim());
    localStorage.removeItem(SAVED_PEER_ID_KEY);
    
    setIsConfigModalOpen(false);
    addLog(`Configuração gravada. Reiniciando subsistema de rede no modo [${deviceMode}]...`, 'warning');
    window.location.reload();
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNodeName.trim()) {
      setMyNodeName(tempNodeName.trim());
      localStorage.setItem(NODE_NAME_KEY, tempNodeName.trim());
      setIsRenameModalOpen(false);
      addLog(`Identificação do dispositivo atualizada: ${tempNodeName.trim()}`, 'info');
      broadcastMyData();
    }
  };

  const copyToClipboard = () => {
    try {
      const dummy = document.createElement("input");
      document.body.appendChild(dummy);
      dummy.value = myNodeId;
      dummy.select();
      document.execCommand("copy");
      document.body.removeChild(dummy);
      setCopiedId(true);
      addLog('ID P2P estático copiado com sucesso!', 'info');
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      addLog('Falha ao usar área de transferência.', 'warning');
    }
  };

  const filteredTickets = tickets.filter((t: Ticket) => {
    const matchesCategory = filterCategory === 'Todos' || t.category === filterCategory;
    const matchesPriority = filterPriority === 'Todos' || t.priority === filterPriority;
    return matchesCategory && matchesPriority;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* HEADER PRINCIPAL */}
      <header className="border-b border-slate-850 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/15 p-2 rounded-xl border border-emerald-500/30">
              {deviceMode === 'central' ? (
                <Laptop className="h-6 w-6 text-emerald-400 animate-pulse" />
              ) : (
                <Smartphone className="h-6 w-6 text-indigo-400" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight flex items-center gap-1.5">
                MeshDesk <span className="text-[10px] bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded-full font-mono font-normal">STABLE P2P</span>
              </h1>
              <p className="text-[10px] text-slate-400">
                {deviceMode === 'central' ? 'MODO SERVIDOR CENTRAL (8H+ ATIVO)' : 'MODO TERMINAL DE CAMPO'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center w-full sm:w-auto">
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] px-3 py-1.5 rounded-lg font-semibold border border-slate-700 transition-all active:scale-95"
            >
              <Settings className="h-3.5 w-3.5" />
              Modo de Rede
            </button>
            {connections.length > 0 && (
              <button 
                onClick={() => { broadcastMyData(); addLog('Sincronização manual com todos os terminais iniciada.', 'success'); }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95 shadow-sm"
              >
                <RefreshCw className="h-3 w-3" />
                Forçar Sincronia
              </button>
            )}
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-[11px] flex items-center gap-1.5 font-mono">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connections.length > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${connections.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              Conexões: {connections.length}
            </div>
          </div>

        </div>
      </header>

      {/* PAINEL DE MONITORAMENTO E CONFIGURAÇÃO ESTÁTICA */}
      <section className="bg-slate-950/50 border-b border-slate-850 px-4 py-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* PAINEL CENTRAL DO DISPOSITIVO */}
          <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Configuração Local</span>
                <button 
                  onClick={() => { setTempNodeName(myNodeName); setIsRenameModalOpen(true); }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  Editar Nome
                </button>
              </div>
              <h2 className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                {deviceMode === 'central' ? <Laptop className="h-4 w-4 text-emerald-400" /> : <Smartphone className="h-4 w-4 text-indigo-400" />}
                {myNodeName}
              </h2>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 block font-mono">
                {deviceMode === 'central' ? 'ID FIXO DO SERVIDOR (ENVIE PARA OS TERMINAIS):' : 'SEU ID ESTÁTICO DE TERMINAL:'}
              </label>
              {myNodeId ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={myNodeId}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-mono focus:outline-none"
                  />
                  <button 
                    onClick={copyToClipboard}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all text-slate-200"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedId ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-amber-400 flex items-center gap-1.5 font-mono py-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Registrando ID estático de hardware...
                </div>
              )}
            </div>
          </div>

          {/* PAREAMENTO DIRETO / ENDEREÇAMENTO MANUAL */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">
                {deviceMode === 'central' ? 'Adicionar Novo Terminal Manualmente' : 'Parear com outro Terminal'}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {deviceMode === 'central' 
                  ? 'Geralmente os terminais conectam ao servidor. Mas você também pode forçar a conexão por aqui.'
                  : 'Insira o ID de outro dispositivo para sincronização de campo.'}
              </p>
            </div>

            <form onSubmit={connectToDevice} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Insira o ID de conexão P2P..." 
                value={targetPeerId}
                onChange={(e) => setTargetPeerId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600 text-slate-200"
                required
              />
              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Conectar
              </button>
            </form>
          </div>

          {/* LISTA DE TERMINAIS MÓVEIS SEGUIDOS */}
          <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">
              {deviceMode === 'central' ? 'Terminais Conectados' : 'Dispositivos Pareados'} ({connections.length})
            </span>
            
            {connections.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-slate-500 text-xs italic font-mono">
                <WifiOff className="h-4 w-4" />
                Aguardando conexões...
              </div>
            ) : (
              <div className="max-h-24 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                {connections.map((c) => (
                  <div key={c.peerId} className="flex items-center justify-between bg-slate-950/60 p-1.5 rounded-md border border-slate-850">
                    <span className="text-xs text-slate-200 truncate pr-2 font-medium flex items-center gap-1">
                      <Smartphone className="h-3 w-3 text-slate-500" />
                      {c.name}
                    </span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">Online</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* CORE WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA: NOVO CHAMADO E GERENCIADOR DE BACKUP */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* NOVO CHAMADO */}
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-2 border-b border-slate-850">
              <PlusCircle className="h-4 w-4 text-indigo-400" />
              Abrir Ocorrência de TI
            </h2>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Ocorrência / Sintoma</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Teclado quebrado ou Monitor sem sinal" 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-100 placeholder:text-slate-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Solicitante</label>
                  <input 
                    type="text" 
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    placeholder="Nome" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-100 placeholder:text-slate-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Categoria</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
                  >
                    <option value="Rede">Rede</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Acessos">Acessos</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Prioridade</label>
                <select 
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Salvar no Dispositivo
              </button>

            </form>
          </div>

          {/* GERENCIAMENTO DE SEGURANÇA E BACKUPS - EXCLUSIVO MODO SERVIDOR */}
          {deviceMode === 'central' && (
            <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3">
              <h3 className="font-bold text-[10px] tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-mono border-b border-slate-850 pb-2">
                <Database className="h-3.5 w-3.5 text-indigo-400" />
                Garantia e Backup de Dados
              </h3>
              
              <p className="text-[11px] text-slate-400 leading-relaxed">
                O sistema utiliza o banco de dados do navegador. Reiniciar o computador, fechar a aba ou desligar o sistema **não apaga** seus dados. Mas você pode gerar cópias físicas para segurança.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleExportBackup}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 py-2 px-2.5 rounded-lg border border-slate-700 transition-all active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar Backup
                </button>
                
                <label className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 py-2 px-2.5 rounded-lg border border-slate-700 transition-all active:scale-95 cursor-pointer text-center">
                  <Upload className="h-3.5 w-3.5" />
                  Importar Backup
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportBackup} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          )}

          {/* LOGS DE EVENTO - EXCLUSIVO MODO SERVIDOR */}
          {deviceMode === 'central' && (
            <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3">
              <h3 className="font-bold text-[10px] tracking-wider uppercase text-slate-400 flex items-center gap-1.5 font-mono border-b border-slate-850 pb-2">
                <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                Eventos e Enlaces de Rede
              </h3>

              <div className="bg-slate-900 rounded-lg p-2.5 h-36 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-1.5 border border-slate-950 scrollbar-thin scrollbar-thumb-slate-800">
                {logs.map((log) => {
                  let colorClass = 'text-slate-400';
                  if (log.type === 'success') colorClass = 'text-emerald-400';
                  if (log.type === 'warning') colorClass = 'text-amber-400';
                  if (log.type === 'error') colorClass = 'text-rose-400 font-semibold';
                  if (log.type === 'sync') colorClass = 'text-indigo-300';

                  return (
                    <div key={log.id} className="border-b border-slate-950/35 pb-1 last:border-0">
                      <span className="text-slate-600 mr-1.5">[{log.time}]</span>
                      <span className={colorClass}>{log.message}</span>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

        </section>

        {/* COLUNA DIREITA: FILA DE CHAMADOS */}
        <section className="lg:col-span-8 space-y-6">

          {/* LISTA DE FILAS */}
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-5 space-y-4">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-2 border-b border-slate-850">
              <div>
                <h2 className="text-sm font-bold text-slate-200">Fila de Chamados Ativa</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Sincronizados localmente neste nó: <strong className="text-indigo-400 font-mono">{tickets.length} ocorrências</strong></p>
              </div>

              {/* FILTROS */}
              <div className="flex gap-2 w-full md:w-auto">
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value="Todos">Todas Categorias</option>
                  <option value="Rede">Rede</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Software">Software</option>
                  <option value="Acessos">Acessos</option>
                </select>
                <select 
                  value={filterPriority} 
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value="Todos">Todas Prioridades</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>

            {/* SE FILA VAZIA */}
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 space-y-2">
                <AlertCircle className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">Nenhum chamado pendente ou resolvido nesta categoria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => {
                  let priorityBadge = '';
                  if (ticket.priority === 'alta') priorityBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                  if (ticket.priority === 'media') priorityBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                  if (ticket.priority === 'baixa') priorityBadge = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';

                  let statusIcon = <Clock className="h-3.5 w-3.5 text-amber-400" />;
                  let statusBg = 'bg-amber-500/5 text-amber-400 border-amber-500/10';
                  if (ticket.status === 'em_atendimento') {
                    statusIcon = <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />;
                    statusBg = 'bg-indigo-500/5 text-indigo-400 border-indigo-500/10';
                  } else if (ticket.status === 'concluido') {
                    statusIcon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
                    statusBg = 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10';
                  }

                  return (
                    <div 
                      key={ticket.id} 
                      className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 rounded-lg p-4 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-mono font-bold tracking-wider ${priorityBadge}`}>
                            {ticket.priority}
                          </span>
                          <span className="text-[9px] bg-slate-850 text-slate-300 border border-slate-750 px-2 py-0.5 rounded font-mono">
                            {ticket.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-bold">ID: #{ticket.id.slice(-4)}</span>
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-slate-100">{ticket.title}</h3>
                        
                        <div className="flex items-center gap-3 text-[10px] sm:text-xs text-slate-400 flex-wrap pt-0.5">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-500" /> Solicitante: <strong className="text-slate-300 font-medium">{ticket.user}</strong>
                          </span>
                          <span className="text-slate-700">|</span>
                          <span>Editado por: <strong className="text-indigo-400 font-mono font-medium">{ticket.lastUpdatedBy}</strong></span>
                          <span className="text-slate-700">|</span>
                          <span className="text-[9px] text-slate-500 font-mono">versão: {ticket.version}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t border-slate-850 md:border-t-0 pt-3 md:pt-0">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded border ${statusBg}`}>
                            {statusIcon}
                          </div>
                          <select 
                            value={ticket.status}
                            onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="em_atendimento">Em Atendimento</option>
                            <option value="concluido">Resolvido</option>
                          </select>
                        </div>

                        <button 
                          onClick={() => deleteTicket(ticket.id)}
                          className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-lg transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </section>

      </main>

      {/* MODAL CONFIGURAÇÃO DO TIPO DE DISPOSITIVO (REDE) */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <Laptop className="h-4 w-4 text-indigo-400" />
                Configurar Modo de Rede
              </h3>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-medium">Este computador/aparelho é o:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeviceMode('central')}
                    className={`py-3 px-3 rounded-xl border font-semibold text-xs transition-all ${
                      deviceMode === 'central'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    Servidor Central
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode('terminal')}
                    className={`py-3 px-3 rounded-xl border font-semibold text-xs transition-all ${
                      deviceMode === 'terminal'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    Terminal Técnico
                  </button>
                </div>
              </div>

              {deviceMode === 'terminal' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs text-slate-400 font-medium">ID de Pareamento do Servidor Central:</label>
                  <input 
                    type="text" 
                    value={centralServerIdInput}
                    onChange={(e) => setCentralServerIdInput(e.target.value)}
                    placeholder="Cole o ID estável do Servidor" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <p className="text-[10px] text-slate-500 italic">O terminal usará este ID para reconectar sozinho caso o Servidor Central reinicie.</p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsConfigModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3.5 py-2 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold shadow-lg shadow-indigo-600/20"
                >
                  Aplicar & Reiniciar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR NOME */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-indigo-400" />
                Identificar Dispositivo
              </h3>
              <button onClick={() => setIsRenameModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRename} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">Nome deste Nó/Aparelho:</label>
                <input 
                  type="text" 
                  value={tempNodeName}
                  onChange={(e) => setTempNodeName(e.target.value)}
                  placeholder="Ex: Desktop do Faturamento" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-100"
                  required
                  maxLength={30}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsRenameModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3.5 py-2 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-850 bg-slate-950/80 py-3 text-center text-[10px] text-slate-500 font-mono">
        <p>Sistema Ativo de Ocorrências P2P — Sincronização Estável & Auto-Reconexão de Terminais.</p>
      </footer>

    </div>
  );
}