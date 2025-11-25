import React, { useState, useEffect, useRef } from 'react';
import { authenticateUser, saveTeacherConfig, getStudentResults, getTeacherConfigs, getUsers, saveUser, deleteUser, updateUserPassword, exportDatabase, importDatabase, isSystemOffline, retryCloudConnection } from '../services/storageService';
import { Subject, Bimester, StudentResult, User, UserRole } from '../types';

interface Props {
  onBack: () => void;
}

export const TeacherDashboard: React.FC<Props> = ({ onBack }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [connectionErrorDetail, setConnectionErrorDetail] = useState('');

  // Dashboard Tab State
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'users' | 'profile'>('config');

  // Config State
  const [subject, setSubject] = useState<Subject>('História');
  const [bimester, setBimester] = useState<Bimester>('1º Bimestre');
  const [topics, setTopics] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  // Results State
  const [results, setResults] = useState<StudentResult[]>([]);
  
  // Results Filters
  const [filterClass, setFilterClass] = useState<string>('Todas');
  const [filterSubject, setFilterSubject] = useState<string>('Todas');
  const [uniqueClasses, setUniqueClasses] = useState<string[]>([]);

  // User Management State (Director only)
  const [usersList, setUsersList] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'TEACHER' as UserRole });
  const [userMsg, setUserMsg] = useState('');

  // Change Password State
  const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ text: '', type: '' as 'success' | 'error' });

  // Backup State
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data when tabs change or user logs in
  useEffect(() => {
    if (currentUser) {
        setIsLoading(true);
        // Check connectivity status
        setIsOffline(isSystemOffline());

        const fetchData = async () => {
            try {
                // Load existing config
                const configs = await getTeacherConfigs();
                const current = configs.find(c => c.subject === subject && c.bimester === bimester);
                if (current) setTopics(current.topics);
                else setTopics('');

                // Load results
                const allResults = await getStudentResults();
                setResults(allResults);

                // Extract unique classes for filter
                const classes = Array.from(new Set(allResults.map(r => r.studentClass || 'N/A').filter(c => c !== 'N/A'))).sort();
                setUniqueClasses(classes);

                // Load users if Director
                if (currentUser.role === 'DIRECTOR') {
                    const u = await getUsers();
                    setUsersList(u);
                }
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setIsLoading(false);
                setIsOffline(isSystemOffline());
            }
        };
        fetchData();
    }
  }, [currentUser, subject, bimester, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        const user = await authenticateUser(loginUser, loginPass);
        if (user) {
          setCurrentUser(user);
          setAuthError('');
        } else {
          setAuthError("Usuário ou senha incorretos.");
        }
    } catch (e) {
        setAuthError("Erro na conexão com servidor. Tente novamente.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    setIsLoading(true);
    setConnectionErrorDetail('');
    const result = await retryCloudConnection();
    if (result.success) {
      setIsOffline(false);
      alert("Conexão restabelecida com sucesso!");
      // Reload data
      const allResults = await getStudentResults();
      setResults(allResults);
    } else {
      setIsOffline(true);
      setConnectionErrorDetail(result.error || 'Erro desconhecido');
    }
    setIsLoading(false);
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    await saveTeacherConfig({
      subject,
      bimester,
      topics,
      isActive: true,
      lastModifiedBy: currentUser?.username
    });
    setIsLoading(false);
    setIsOffline(isSystemOffline());
    setSaveMessage(isSystemOffline() ? 'Salvo localmente (Offline).' : 'Conteúdo sincronizado na Nuvem!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          await saveUser({
              name: newUser.name,
              username: newUser.username,
              password: newUser.password,
              role: newUser.role
          });
          const updatedUsers = await getUsers();
          setUsersList(updatedUsers);
          setNewUser({ name: '', username: '', password: '', role: 'TEACHER' });
          setUserMsg('Usuário cadastrado com sucesso!');
      } catch (err: any) {
          setUserMsg(err.message);
      } finally {
          setIsLoading(false);
      }
      setTimeout(() => setUserMsg(''), 3000);
  };

  const handleDeleteUser = async (username: string) => {
      if(window.confirm(`Tem certeza que deseja remover ${username}?`)) {
          try {
              await deleteUser(username);
              const updatedUsers = await getUsers();
              setUsersList(updatedUsers);
          } catch (err: any) {
              alert(err.message);
          }
      }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPwdMsg({ text: '', type: 'error' });

      if (pwdData.new !== pwdData.confirm) {
          setPwdMsg({ text: 'A nova senha e a confirmação não conferem.', type: 'error' });
          return;
      }

      if (pwdData.new.length < 6) {
          setPwdMsg({ text: 'A nova senha deve ter pelo menos 6 caracteres.', type: 'error' });
          return;
      }

      try {
          if (currentUser) {
            await updateUserPassword(currentUser.username, pwdData.current, pwdData.new);
            setPwdMsg({ text: 'Senha alterada com sucesso!', type: 'success' });
            setPwdData({ current: '', new: '', confirm: '' });
          }
      } catch (err: any) {
          setPwdMsg({ text: err.message, type: 'error' });
      }
  };

  const handleExportData = async () => {
      const json = await exportDatabase();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_veritas_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (await importDatabase(content)) {
              alert("Dados restaurados com sucesso! O sistema será recarregado.");
              window.location.reload();
          } else {
              alert("Erro ao ler o arquivo de backup.");
          }
      };
      reader.readAsText(file);
  };

  // Filter Logic
  const filteredResults = results
    .filter(r => filterClass === 'Todas' || r.studentClass === filterClass)
    .filter(r => filterSubject === 'Todas' || r.subject === filterSubject)
    .sort((a, b) => {
       if (a.studentClass < b.studentClass) return -1;
       if (a.studentClass > b.studentClass) return 1;
       return a.studentName.localeCompare(b.studentName);
    });

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full">
           <div className="text-center mb-6">
               <h2 className="text-2xl font-serif font-bold text-slate-900">Acesso Restrito</h2>
               <p className="text-slate-500 text-sm">Escola Estadual Frederico José Pedreira Neto</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Usuário</label>
                <input 
                  type="text" 
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="w-full mt-1 p-3 border rounded border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: diretor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <input 
                  type="password" 
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full mt-1 p-3 border rounded border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="********"
                />
              </div>
              {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
              
              <button type="submit" disabled={isLoading} className="w-full bg-indigo-900 text-white py-3 rounded font-bold hover:bg-indigo-800 transition disabled:opacity-50 flex justify-center items-center gap-2">
                {isLoading && (
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                )}
                {isLoading ? 'Conectando...' : 'Entrar no Sistema'}
              </button>
           </form>
           
           <button onClick={onBack} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 w-full text-center">
             ← Voltar para Área do Aluno
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[600px]">
      <div className="bg-indigo-900 text-white p-6 flex justify-between items-center flex-wrap gap-4">
         <div>
           <h2 className="text-2xl font-serif font-bold">Painel Administrativo</h2>
           <p className="opacity-80 text-sm">Olá, {currentUser.name} ({currentUser.role === 'DIRECTOR' ? 'Diretor' : 'Professor'})</p>
         </div>
         <div className="flex items-center gap-3">
             <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${isOffline ? 'bg-amber-400 text-amber-900' : 'bg-emerald-400 text-emerald-900'}`}>
                <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-800' : 'bg-emerald-800 animate-pulse'}`}></span>
                {isOffline ? 'OFFLINE (Local)' : 'ONLINE (Nuvem)'}
             </div>
             <button onClick={() => setCurrentUser(null)} className="text-sm bg-indigo-800 hover:bg-indigo-700 px-4 py-2 rounded transition">
                Sair
             </button>
         </div>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto">
         <button 
           onClick={() => setActiveTab('config')}
           className={`flex-1 py-4 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'config' ? 'text-indigo-900 border-b-2 border-indigo-900 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
         >
            Configurar Provas
         </button>
         <button 
           onClick={() => setActiveTab('results')}
           className={`flex-1 py-4 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'results' ? 'text-indigo-900 border-b-2 border-indigo-900 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
         >
            Boletim de Notas
         </button>
         {currentUser.role === 'DIRECTOR' && (
             <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-4 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'users' ? 'text-indigo-900 border-b-2 border-indigo-900 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                Gestão de Usuários
             </button>
         )}
         <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'profile' ? 'text-indigo-900 border-b-2 border-indigo-900 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
         >
            Meu Perfil / Backup
         </button>
      </div>

      <div className="p-8">
        {isLoading && <p className="text-center text-indigo-600 mb-4 animate-pulse">Processando...</p>}
        
        {isOffline && (
            <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-lg flex flex-col md:flex-row items-start gap-4">
               <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <div>
                    <p className="text-sm font-bold text-amber-800">Modo Offline Ativado</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Não foi possível conectar ao banco de dados do Google. Os dados estão sendo salvos apenas <strong>neste computador</strong>. 
                      Isso pode ocorrer se o Project ID estiver errado ou o banco não tiver sido criado no console do Firebase.
                    </p>
                    {connectionErrorDetail && (
                       <div className="mt-2 p-2 bg-amber-100 rounded text-xs font-mono text-red-700">
                          Erro: {connectionErrorDetail}
                       </div>
                    )}
                  </div>
               </div>
               <button 
                  onClick={handleRetryConnection}
                  className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded shadow-sm"
               >
                  Tentar Reconectar
               </button>
            </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-6 max-w-3xl mx-auto">
             <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-900 text-sm">
               <strong>Instrução:</strong> Defina os tópicos que a IA deve priorizar na geração da prova. Deixe em branco para usar o currículo padrão do MEC.
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Disciplina</label>
                   <select 
                     value={subject} 
                     onChange={(e) => setSubject(e.target.value as Subject)}
                     className="w-full p-2 border rounded bg-white"
                   >
                      <option value="História">História</option>
                      <option value="Geografia">Geografia</option>
                      <option value="Filosofia">Filosofia</option>
                      <option value="Sociologia">Sociologia</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">Bimestre</label>
                   <select 
                     value={bimester} 
                     onChange={(e) => setBimester(e.target.value as Bimester)}
                     className="w-full p-2 border rounded bg-white"
                   >
                      <option value="1º Bimestre">1º Bimestre</option>
                      <option value="2º Bimestre">2º Bimestre</option>
                      <option value="3º Bimestre">3º Bimestre</option>
                      <option value="4º Bimestre">4º Bimestre</option>
                   </select>
                </div>
             </div>

             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Tópicos da Avaliação (Conteúdo Programático)</label>
               <textarea
                 value={topics}
                 onChange={(e) => setTopics(e.target.value)}
                 className="w-full h-40 p-4 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                 placeholder="Ex: Revolução Industrial, Movimento Operário, Urbanização Europeia, Conceito de Ética em Kant..."
               />
               <p className="text-xs text-slate-500 mt-2">Separe os tópicos por vírgula ou nova linha.</p>
             </div>

             <button 
               onClick={handleSaveConfig}
               disabled={isLoading}
               className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-bold w-full md:w-auto shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
             >
                {isLoading && (
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                )}
               {isLoading ? 'Salvando...' : 'Salvar Conteúdo da Prova'}
             </button>
             
             {saveMessage && (
               <p className="text-green-600 font-medium animate-pulse">{saveMessage}</p>
             )}
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <div>
                 <h3 className="font-bold text-lg text-slate-800">Boletim Escolar</h3>
                 <p className="text-xs text-slate-500">Visualizando {filteredResults.length} avaliações</p>
               </div>
               
               <div className="flex gap-2">
                 {/* Filters */}
                 <select 
                    value={filterClass} 
                    onChange={e => setFilterClass(e.target.value)}
                    className="p-2 border rounded text-sm bg-white font-medium"
                 >
                    <option value="Todas">Todas as Turmas</option>
                    {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>

                 <select 
                    value={filterSubject} 
                    onChange={e => setFilterSubject(e.target.value)}
                    className="p-2 border rounded text-sm bg-white font-medium"
                 >
                    <option value="Todas">Todas as Disciplinas</option>
                    <option value="História">História</option>
                    <option value="Geografia">Geografia</option>
                    <option value="Filosofia">Filosofia</option>
                    <option value="Sociologia">Sociologia</option>
                 </select>
               </div>
            </div>
            
            {filteredResults.length === 0 ? (
              <p className="text-slate-500 text-center py-10 bg-slate-50 rounded">Nenhum resultado encontrado para este filtro.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider font-bold">
                      <th className="p-3 border-b">Turma</th>
                      <th className="p-3 border-b">Aluno</th>
                      <th className="p-3 border-b">Disciplina / Bimestre</th>
                      <th className="p-3 border-b">Data</th>
                      <th className="p-3 border-b text-center">Cola (Tentativas)</th>
                      <th className="p-3 border-b text-right">Nota Final</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm bg-white">
                    {filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                        <td className="p-3 font-bold text-indigo-900 bg-indigo-50/30">{r.studentClass || 'N/A'}</td>
                        <td className="p-3 font-medium text-slate-900">{r.studentName}</td>
                        <td className="p-3">
                           <div className="font-bold text-slate-700">{r.subject}</div>
                           <div className="text-xs text-slate-500">{r.bimester}</div>
                        </td>
                        <td className="p-3 text-slate-500 text-xs">{new Date(r.date).toLocaleDateString()} <br/> {new Date(r.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="p-3 text-center">
                          {r.violations > 0 ? (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">{r.violations}</span>
                          ) : (
                            <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-bold px-3 py-1 rounded text-sm ${r.score >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {r.score.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && currentUser.role === 'DIRECTOR' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* List Users */}
                 <div className="lg:col-span-2">
                    <h3 className="font-bold text-lg text-slate-800 mb-4">Equipe Cadastrada</h3>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-left bg-white">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3">Nome</th>
                                    <th className="p-3">Usuário</th>
                                    <th className="p-3">Cargo</th>
                                    <th className="p-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {usersList.map(u => (
                                    <tr key={u.username} className="border-t border-slate-100">
                                        <td className="p-3 font-medium text-slate-900">{u.name}</td>
                                        <td className="p-3 text-slate-500">{u.username}</td>
                                        <td className="p-3">
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${u.role === 'DIRECTOR' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {u.role === 'DIRECTOR' ? 'Diretor' : 'Professor'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            {u.username !== currentUser.username && (
                                                <button 
                                                    onClick={() => handleDeleteUser(u.username)}
                                                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                                                >
                                                    Remover
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>

                 {/* Add User Form */}
                 <div className="bg-slate-50 p-6 rounded-xl h-fit">
                     <h3 className="font-bold text-slate-800 mb-4">Cadastrar Novo Professor</h3>
                     <form onSubmit={handleCreateUser} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                            <input 
                                required
                                type="text" 
                                className="w-full p-2 border rounded text-sm"
                                value={newUser.name}
                                onChange={e => setNewUser({...newUser, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário de Acesso</label>
                            <input 
                                required
                                type="text" 
                                className="w-full p-2 border rounded text-sm"
                                value={newUser.username}
                                onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s/g,'')})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha Provisória</label>
                            <input 
                                required
                                type="text" 
                                className="w-full p-2 border rounded text-sm"
                                value={newUser.password}
                                onChange={e => setNewUser({...newUser, password: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
                            <select 
                                className="w-full p-2 border rounded text-sm bg-white"
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                            >
                                <option value="TEACHER">Professor</option>
                                <option value="DIRECTOR">Diretor / Admin</option>
                            </select>
                        </div>
                        
                        <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-bold text-sm shadow disabled:opacity-50 flex justify-center items-center gap-2">
                             {isLoading && (
                               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                               </svg>
                            )}
                            {isLoading ? 'Processando...' : 'Cadastrar'}
                        </button>
                        {userMsg && <p className="text-center text-xs text-green-600 font-bold mt-2">{userMsg}</p>}
                     </form>
                 </div>
             </div>
        )}

        {activeTab === 'profile' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Change Password */}
               <div>
                   <div className="mb-6">
                     <h3 className="font-bold text-lg text-slate-800">Alterar Senha</h3>
                     <p className="text-sm text-slate-500">Atualize suas credenciais de acesso.</p>
                   </div>

                   <form onSubmit={handleChangePassword} className="bg-slate-50 p-6 rounded-xl space-y-4 border border-slate-200">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha Atual</label>
                          <input 
                              type="password"
                              required
                              className="w-full p-3 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={pwdData.current}
                              onChange={e => setPwdData({...pwdData, current: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
                          <input 
                              type="password"
                              required
                              className="w-full p-3 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={pwdData.new}
                              onChange={e => setPwdData({...pwdData, new: e.target.value})}
                              placeholder="Mínimo 6 caracteres"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Nova Senha</label>
                          <input 
                              type="password"
                              required
                              className="w-full p-3 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={pwdData.confirm}
                              onChange={e => setPwdData({...pwdData, confirm: e.target.value})}
                          />
                      </div>

                      {pwdMsg.text && (
                          <div className={`p-3 rounded text-sm text-center ${pwdMsg.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {pwdMsg.text}
                          </div>
                      )}

                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded font-bold shadow-sm transition">
                          Atualizar Senha
                      </button>
                   </form>
               </div>

               {/* Backup Section */}
               <div>
                   <div className="mb-6">
                     <h3 className="font-bold text-lg text-slate-800">Backup e Segurança</h3>
                     <p className="text-sm text-slate-500">Exporte os dados para evitar perdas.</p>
                   </div>
                   
                   <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-xl space-y-6">
                      <div>
                          <p className="text-sm text-indigo-900 font-medium mb-2">Exportar Dados</p>
                          <p className="text-xs text-indigo-700 mb-3">Baixe um arquivo contendo todos os usuários, configurações de prova e notas dos alunos.</p>
                          <button 
                             onClick={handleExportData}
                             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded font-bold shadow flex items-center justify-center gap-2"
                          >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             Baixar Backup (.json)
                          </button>
                      </div>
                      
                      <div className="border-t border-indigo-200 pt-6">
                          <p className="text-sm text-indigo-900 font-medium mb-2">Restaurar Dados</p>
                          <p className="text-xs text-indigo-700 mb-3">Carregue um arquivo de backup para restaurar o sistema.</p>
                          <input 
                             type="file" 
                             accept=".json" 
                             ref={fileInputRef}
                             className="hidden"
                             onChange={handleImportData}
                          />
                          <button 
                             onClick={() => fileInputRef.current?.click()}
                             className="w-full bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-50 py-3 rounded font-bold flex items-center justify-center gap-2"
                          >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                             Carregar Backup
                          </button>
                      </div>
                   </div>
               </div>
           </div>
        )}
      </div>
    </div>
  );
};