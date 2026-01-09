import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  Truck, 
  AlertTriangle, 
  Save, 
  RefreshCw,
  Box,
  CheckCircle2,
  Search,
  Link as LinkIcon,
  LogOut,
  DownloadCloud,
  FileJson,
  Activity
} from 'lucide-react';
import { Product, Tab, LogisticsAnalysis, MeliUser } from './types';
import { analyzeLogistics } from './services/geminiService';
import { getMeliUser, getSellerItems, getItemDetails, updateItemDimensions } from './services/meliService';

// Mock Data (Fallback)
const INITIAL_PRODUCTS: Product[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PRODUCTS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [analysis, setAnalysis] = useState<LogisticsAnalysis | null>(null);
  
  // States de Carregamento e Autenticação
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Mercado Livre Auth - Token Atualizado (Do primeiro JSON fornecido)
  const [accessToken, setAccessToken] = useState('APP_USR-4401561952264899-010908-d064b634dd92f8e7df1cafed1de5c9f4-330375081');
  const [jsonInput, setJsonInput] = useState('');
  const [meliUser, setMeliUser] = useState<MeliUser | null>(null);
  const [authError, setAuthError] = useState('');
  
  // Debug State
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // --- Auto Initialization ---
  useEffect(() => {
    const autoInit = async () => {
      if (!accessToken) return;
      
      try {
        setIsSyncing(true);
        addLog("Iniciando conexão automática...");
        
        // 1. Conectar Usuário
        const user = await getMeliUser(accessToken);
        setMeliUser(user);
        addLog(`Usuário autenticado: ${user.nickname} (ID: ${user.id})`);
        
        // 2. Tentar baixar produtos automaticamente
        setIsImporting(true);
        const ids = await getSellerItems(accessToken, user.id);
        addLog(`IDs encontrados: ${ids.length} anúncios.`);
        
        if (ids.length > 0) {
          const realProducts = await getItemDetails(accessToken, ids);
          setProducts(realProducts);
          addLog(`Detalhes carregados: ${realProducts.length} produtos.`);
        } else {
          addLog("Nenhum anúncio ativo encontrado para este token.");
        }
      } catch (err: any) {
        console.error("Auto-connect error:", err);
        const errorMsg = err.message || "Erro desconhecido";
        setAuthError(`Erro na conexão: ${errorMsg}`);
        addLog(`ERRO: ${errorMsg}`);
        
        if (errorMsg.includes("Failed to fetch")) {
          addLog("DICA: Isso geralmente é bloqueio de CORS do navegador ou bloqueador de anúncios.");
        }
        
        setActiveTab(Tab.SETTINGS); // Levar usuário para configurações se falhar
      } finally {
        setIsSyncing(false);
        setIsImporting(false);
      }
    };

    autoInit();
  }, []); // Executa apenas uma vez ao montar

  // --- Logic Handlers ---

  const handleParseJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.access_token) {
        setAccessToken(parsed.access_token);
        setJsonInput(''); // Limpar campo
        addLog("Novo token extraído do JSON.");
        // Disparar conexão manual
        connectWithToken(parsed.access_token);
      } else {
        alert("JSON inválido: campo 'access_token' não encontrado.");
      }
    } catch (e) {
      alert("Erro ao ler JSON. Verifique se copiou corretamente.");
    }
  };

  const connectWithToken = async (token: string) => {
    setAuthError('');
    setIsSyncing(true);
    addLog("Tentando conexão manual...");
    try {
      const user = await getMeliUser(token);
      setMeliUser(user);
      addLog(`Sucesso! Usuário: ${user.nickname}`);
      handleImportProducts(token, user.id);
    } catch (err: any) {
      const msg = err.message || "Erro";
      setAuthError(msg);
      addLog(`Falha na conexão manual: ${msg}`);
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectMeli = () => {
    if (!accessToken) {
      setAuthError('Por favor, insira um token.');
      return;
    }
    connectWithToken(accessToken);
  };

  const handleImportProducts = async (token = accessToken, userId?: number) => {
    const uid = userId || meliUser?.id;
    if (!token || !uid) {
      alert("Conecte sua conta primeiro na aba Configurações.");
      setActiveTab(Tab.SETTINGS);
      return;
    }

    setIsImporting(true);
    try {
      addLog("Buscando lista de itens...");
      // 1. Buscar IDs
      const ids = await getSellerItems(token, uid);
      if (ids.length === 0) {
        alert("Nenhum anúncio ativo encontrado nesta conta.");
        addLog("Nenhum item retornado pela API.");
        return;
      }
      addLog(`Baixando detalhes de ${ids.length} itens...`);
      // 2. Buscar Detalhes
      const realProducts = await getItemDetails(token, ids);
      setProducts(realProducts);
      addLog("Produtos atualizados na tabela.");
    } catch (err: any) {
      console.error(err);
      addLog(`Erro ao importar: ${err.message}`);
      alert("Erro ao importar produtos. Verifique o Log em Configurações.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct({ ...product }); // Create a copy for editing
    setAnalysis(null);
  };

  const handleInputChange = (field: string, value: any) => {
    if (!selectedProduct) return;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setSelectedProduct({
        ...selectedProduct,
        [parent]: {
          ...selectedProduct[parent as keyof Product] as any,
          [child]: parseFloat(value) || 0
        }
      });
    } else {
      setSelectedProduct({
        ...selectedProduct,
        [field]: value
      });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedProduct) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeLogistics(selectedProduct);
      setAnalysis(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAndSync = async () => {
    if (!selectedProduct) return;
    setIsSyncing(true);
    addLog(`Enviando atualização para item ${selectedProduct.sku}...`);
    
    try {
      // Chamada real para atualizar no Mercado Livre
      await updateItemDimensions(accessToken, selectedProduct);
      
      // Atualiza estado local
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...selectedProduct, lastSync: new Date().toLocaleTimeString() } : p));
      addLog("Atualização realizada com sucesso no ML!");
      alert(`Sucesso! Dimensões do produto "${selectedProduct.sku}" atualizadas no Mercado Livre.`);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      addLog(`Erro ao salvar no ML: ${error.message}`);
      alert("Erro ao atualizar no Mercado Livre. Verifique o Log.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Components ---

  const SidebarItem = ({ icon: Icon, label, tab }: { icon: any, label: string, tab: Tab }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === tab 
          ? 'bg-ml-blue text-white' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  const ProductList = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Seus Produtos ({products.length})</h2>
        <div className="flex gap-2">
          {meliUser && (
             <button 
               onClick={() => handleImportProducts()}
               disabled={isImporting}
               className="flex items-center gap-2 px-4 py-2 bg-white border border-ml-blue text-ml-blue rounded-lg hover:bg-blue-50 text-sm font-medium transition-colors"
             >
               {isImporting ? <RefreshCw className="animate-spin" size={16} /> : <DownloadCloud size={16} />}
               Atualizar Lista
             </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar SKU ou Nome..." 
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none w-64"
            />
          </div>
        </div>
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
          <tr>
            <th className="px-6 py-3">Produto</th>
            <th className="px-6 py-3">SKU</th>
            <th className="px-6 py-3">Dimensões (AxLxC)</th>
            <th className="px-6 py-3">Peso</th>
            <th className="px-6 py-3">Status ML</th>
            <th className="px-6 py-3">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {products.map(product => (
            <tr key={product.id} className="hover:bg-blue-50 transition-colors">
              <td className="px-6 py-4 flex items-center gap-3">
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt="" className="w-10 h-10 object-contain rounded border bg-white" />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                    <Package size={20} />
                  </div>
                )}
                <div>
                  <div className="font-medium text-gray-900 line-clamp-1 max-w-[200px]" title={product.title}>{product.title}</div>
                  <div className="text-xs text-gray-400">R$ {product.price.toFixed(2)}</div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {product.dimensions.height || 0}x{product.dimensions.width || 0}x{product.dimensions.length || 0} cm
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{product.weight || 0} kg</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  product.mlStatus === 'active' ? 'bg-green-100 text-green-700' : 
                  product.mlStatus === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>
                  {product.mlStatus === 'active' ? 'Ativo' : 'Pausado'}
                </span>
              </td>
              <td className="px-6 py-4">
                <button 
                  onClick={() => handleSelectProduct(product)}
                  className="text-ml-blue hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                >
                  <Settings size={16} /> Gerenciar
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
             <tr>
               <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                 {isImporting ? (
                    <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="animate-spin" size={20} />
                        Carregando seus produtos...
                    </div>
                 ) : (
                    "Nenhum produto encontrado. Verifique se o token é válido na aba Configurações."
                 )}
               </td>
             </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const ProductEditor = () => {
    if (!selectedProduct) return null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
        {/* Left Column: Editor */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">Editar Dimensões</h3>
            <button onClick={() => setSelectedProduct(null)} className="text-sm text-gray-500 hover:text-gray-800">
              Voltar para lista
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={selectedProduct.title} 
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  disabled
                />
                {selectedProduct.permalink && (
                  <a href={selectedProduct.permalink} target="_blank" rel="noreferrer" className="p-2 text-ml-blue hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-100">
                    <LinkIcon size={20} />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                 <div className="relative">
                   <input 
                    type="number" 
                    value={selectedProduct.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    className="w-full p-2 pl-3 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-ml-blue focus:border-transparent outline-none"
                   />
                   <span className="absolute right-3 top-2 text-gray-400 text-sm">kg</span>
                 </div>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                 <input 
                  type="number" 
                  value={selectedProduct.price}
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                  disabled
                 />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Box size={16} /> Dimensões do Pacote (Para Frete)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Altura (cm)</label>
                  <input 
                    type="number" 
                    value={selectedProduct.dimensions.height}
                    onChange={(e) => handleInputChange('dimensions.height', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Largura (cm)</label>
                  <input 
                    type="number" 
                    value={selectedProduct.dimensions.width}
                    onChange={(e) => handleInputChange('dimensions.width', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Comprimento (cm)</label>
                  <input 
                    type="number" 
                    value={selectedProduct.dimensions.length}
                    onChange={(e) => handleInputChange('dimensions.length', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <><Truck size={20} /> Analisar Logística com IA</>
                )}
              </button>
              
              <button 
                onClick={handleSaveAndSync}
                disabled={isSyncing}
                className="flex-1 bg-ml-blue hover:bg-blue-900 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                 {isSyncing ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <><Save size={20} /> Salvar no Mercado Livre</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis Results */}
        <div className="space-y-6">
          {analysis ? (
             <div className="bg-white rounded-xl shadow-lg border-t-4 border-purple-500 p-6 animate-slide-in">
               <div className="flex items-center gap-2 mb-4">
                 <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                    <Truck size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-gray-800">Análise de Frete (Gemini)</h3>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="p-3 bg-gray-50 rounded-lg">
                   <p className="text-xs text-gray-500 uppercase">Categoria Sugerida</p>
                   <p className="font-semibold text-gray-800">{analysis.category}</p>
                 </div>
                 <div className="p-3 bg-gray-50 rounded-lg">
                   <p className="text-xs text-gray-500 uppercase">Custo Est. (SP-RJ)</p>
                   <p className="font-semibold text-green-600">{analysis.estimatedCost}</p>
                 </div>
                 <div className="p-3 bg-gray-50 rounded-lg">
                   <p className="text-xs text-gray-500 uppercase">Peso Volumétrico</p>
                   <p className="font-semibold text-gray-800">{analysis.volumetricWeight} kg</p>
                 </div>
                 <div className="p-3 bg-gray-50 rounded-lg">
                   <p className="text-xs text-gray-500 uppercase">Status Otimização</p>
                   <div className="flex items-center gap-1">
                     {analysis.isOptimized ? (
                       <span className="text-green-600 flex items-center text-sm font-bold"><CheckCircle2 size={16} className="mr-1"/> Otimizado</span>
                     ) : (
                       <span className="text-red-500 flex items-center text-sm font-bold"><AlertTriangle size={16} className="mr-1"/> Atenção</span>
                     )}
                   </div>
                 </div>
               </div>

               {analysis.warnings.length > 0 && (
                 <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                   <p className="text-xs font-bold text-yellow-800 uppercase mb-2 flex items-center">
                     <AlertTriangle size={14} className="mr-1"/> Alertas
                   </p>
                   <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                     {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
                   </ul>
                 </div>
               )}

               <div className="bg-blue-50 border border-blue-100 p-4 rounded-md">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Dica da IA para Embalagem:</p>
                  <p className="text-sm text-blue-800 italic">"{analysis.packingTips}"</p>
               </div>
             </div>
          ) : (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 p-8 text-center">
              <Box size={48} className="mb-4 opacity-50" />
              <h4 className="font-medium text-gray-600 mb-2">Aguardando Análise</h4>
              <p className="text-sm">Edite as dimensões e clique em "Analisar" para ver sugestões de frete e custos via IA.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center gap-2">
          <div className="w-8 h-8 bg-ml-yellow rounded-full flex items-center justify-center text-ml-blue font-bold">
            M
          </div>
          <span className="text-xl font-bold text-ml-blue">Logistics AI</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" tab={Tab.DASHBOARD} />
          <SidebarItem icon={Package} label="Produtos" tab={Tab.PRODUCTS} />
          <SidebarItem icon={Settings} label="Configurações ML" tab={Tab.SETTINGS} />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${meliUser ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
             <div className="text-xs">
               <p className="font-bold text-blue-900">{meliUser ? 'Conectado' : 'Desconectado'}</p>
               <p className="text-blue-700">{meliUser ? meliUser.nickname : 'Modo Offline'}</p>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {activeTab === Tab.DASHBOARD && 'Visão Geral'}
              {activeTab === Tab.PRODUCTS && (selectedProduct ? 'Editar Produto' : 'Gerenciamento de Produtos')}
              {activeTab === Tab.SETTINGS && 'Configurações'}
            </h1>
            <p className="text-gray-500 mt-1">
              {activeTab === Tab.PRODUCTS && !selectedProduct && 'Gerencie as dimensões e pesos para otimizar o frete no Mercado Livre.'}
              {activeTab === Tab.PRODUCTS && selectedProduct && `Editando SKU: ${selectedProduct.sku}`}
            </p>
          </div>
          {activeTab === Tab.PRODUCTS && !selectedProduct && (
            <button className="bg-ml-blue text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-900 transition-colors">
              + Novo Produto
            </button>
          )}
        </header>

        {activeTab === Tab.DASHBOARD && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-ml-blue">
               <p className="text-gray-500 text-sm font-medium uppercase">Produtos Ativos</p>
               <p className="text-3xl font-bold text-gray-800 mt-2">{products.filter(p => p.mlStatus === 'active').length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-yellow-400">
               <p className="text-gray-500 text-sm font-medium uppercase">Requer Atenção (Pesados)</p>
               <p className="text-3xl font-bold text-gray-800 mt-2">{products.filter(p => p.weight > 10).length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
               <p className="text-gray-500 text-sm font-medium uppercase">Otimizados com IA</p>
               <p className="text-3xl font-bold text-gray-800 mt-2">--</p>
            </div>
            
            <div className="col-span-1 md:col-span-3 bg-white p-6 rounded-xl shadow-sm mt-4">
              <h3 className="font-bold text-gray-800 mb-4">Atalhos Rápidos</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <button onClick={() => setActiveTab(Tab.PRODUCTS)} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 text-left transition-colors">
                    <Package className="text-ml-blue mb-2" />
                    <span className="font-semibold text-gray-700 block">Atualizar Estoque</span>
                 </button>
                 <button className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 text-left transition-colors">
                    <Truck className="text-ml-blue mb-2" />
                    <span className="font-semibold text-gray-700 block">Imprimir Etiquetas</span>
                 </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === Tab.PRODUCTS && (
          selectedProduct ? <ProductEditor /> : <ProductList />
        )}

        {activeTab === Tab.SETTINGS && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Conexão Mercado Livre</h2>
            
            {!meliUser ? (
              <div className="space-y-6">
                
                {/* JSON Import Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <FileJson size={16} /> Importar Token via JSON
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Cole o JSON recebido (contendo access_token) abaixo para preencher automaticamente.</p>
                  <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="w-full h-24 p-2 text-xs font-mono border border-gray-300 rounded-md mb-2"
                    placeholder='{"access_token": "APP_USR...", ...}'
                  />
                  <button 
                    onClick={handleParseJson}
                    className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-900"
                  >
                    Ler JSON e Conectar
                  </button>
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
                  <p className="font-bold mb-1">Status da Conexão</p>
                  <p>O aplicativo está tentando conectar com o token padrão. Se falhar, use a área acima para colar um novo token.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (Manual)</label>
                  <input 
                    type="text" 
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm" 
                    placeholder="APP_USR-123456..." 
                  />
                  {authError && <p className="text-red-500 text-sm mt-1">{authError}</p>}
                </div>
                <button 
                  onClick={handleConnectMeli}
                  disabled={isSyncing}
                  className="w-full bg-ml-blue hover:bg-blue-900 text-white py-3 rounded-lg font-medium flex justify-center items-center gap-2"
                >
                  {isSyncing ? <RefreshCw className="animate-spin" /> : <LinkIcon size={20} />}
                  Conectar Manualmente
                </button>
              </div>
            ) : (
               <div className="space-y-6">
                 <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="bg-green-100 p-3 rounded-full text-green-700">
                       <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{meliUser.nickname}</p>
                      <p className="text-gray-600 text-sm">{meliUser.email}</p>
                      <p className="text-gray-500 text-xs mt-1">ID: {meliUser.id}</p>
                    </div>
                 </div>
                 
                 <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-2">Próximos Passos</h3>
                    <p className="text-sm text-gray-600 mb-4">Agora você pode ir até a aba <strong>Produtos</strong> e clicar em "Atualizar Lista" para trazer seus anúncios reais.</p>
                    <button 
                      onClick={() => setActiveTab(Tab.PRODUCTS)}
                      className="text-ml-blue hover:underline font-medium text-sm"
                    >
                      Ir para Produtos →
                    </button>
                 </div>

                 <button 
                   onClick={() => { setMeliUser(null); setAccessToken(''); setProducts([]); }}
                   className="w-full border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-lg font-medium flex justify-center items-center gap-2"
                 >
                   <LogOut size={18} />
                   Desconectar
                 </button>
               </div>
            )}
            </div>
            
            {/* Debug Console */}
            <div className="bg-gray-900 p-6 rounded-xl shadow-lg text-green-400 font-mono text-xs overflow-hidden flex flex-col h-[500px]">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2">
                 <div className="flex items-center gap-2">
                   <Activity size={14} />
                   <span className="uppercase font-bold">Diagnóstico de Rede (API)</span>
                 </div>
                 <button onClick={() => setDebugLog([])} className="hover:text-white">Limpar</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {debugLog.length === 0 && <span className="opacity-50 italic">Aguardando logs...</span>}
                {debugLog.map((log, i) => (
                  <div key={i} className="break-all border-b border-gray-800 py-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}