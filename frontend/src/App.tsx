import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Upload, X, Image as ImageIcon, ShieldCheck, PenTool, Settings, ChevronDown } from 'lucide-react';

// Your Cloud Run URL
const API_URL = "[https://brand-genius-app-186356869150.europe-west2.run.app](https://brand-genius-app-186356869150.europe-west2.run.app)";

// --- OPTIONS FOR THE BUILDER ---
const ROLES = ["Brand Strategist", "Marketing Executive", "Social Media Manager", "Copywriting Expert", "SEO Specialist"];
const INDUSTRIES = ["Tech & SaaS", "Fashion & Apparel", "Food & Beverage", "Healthcare", "Real Estate", "Finance", "Gaming"];
const TONES = ["Professional & Trustworthy", "Witty & Fun", "Urgent & Sales-heavy", "Empathetic & Warm", "Luxury & Minimalist", "Gen-Z & Trendy"];
const STYLES = ["Clean & Modern", "Cyberpunk & Neon", "Vintage & Retro", "Luxury & Gold", "Pastel & Soft", "Corporate & Blue"];

function App() {
  // --- STATE ---
  const [prompt, setPrompt] = useState("");
  
  // BUILDER STATE
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0]);
  const [selectedTone, setSelectedTone] = useState(TONES[0]);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);

  // CONTEXT
  const [brandContext, setBrandContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  
  // RESULTS
  const [result, setResult] = useState("");
  const [imageUrl, setImageUrl] = useState(""); 
  const [auditScore, setAuditScore] = useState<number | null>(null); // For the score bar
  const [loading, setLoading] = useState(false);
  
  // TABS: 'writer' | 'visual' | 'guardian'
  const [activeTab, setActiveTab] = useState<'writer' | 'visual' | 'guardian'>('writer');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // --- EFFECT: AUTO-BUILD CONTEXT ---
  useEffect(() => {
    const builtContext = `You are a world-class ${selectedRole} for a ${selectedIndustry} company. Your tone of voice is ${selectedTone}. The visual brand identity is ${selectedStyle}.`;
    setBrandContext(builtContext);
  }, [selectedRole, selectedIndustry, selectedTone, selectedStyle]);

  // --- HANDLERS ---
  const removeFile = () => setSelectedFile(null);

  const handleContextExtraction = async (file: File) => {
    setLoading(true);
    try {
        console.log("Extracting context...");
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API_URL}/extract-context-from-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.status === "success") {
            setBrandContext(response.data.extracted_text);
            setShowContext(true); 
            alert("Context extracted! (Note: Dropdowns are now overridden)");
        }
    } catch (error) {
        console.error(error);
        alert("Extraction failed.");
    } finally {
        setLoading(false);
        setSelectedFile(null);
    }
  };

  // --- API CALLS ---
  
  // 1. Writer (Gemini)
  const runWriter = async () => {
    if (!prompt) return;
    setLoading(true); setResult(""); setImageUrl(""); setAuditScore(null);
    try {
      const response = await axios.post(`${API_URL}/generate-copy`, {
          prompt: prompt,
          context: brandContext
      });
      setResult(response.data.response);
    } catch (error) { setResult("Error generating copy."); } 
    finally { setLoading(false); }
  };

  // 2. Visual Studio (Gemini + Imagen)
  const runVisual = async () => {
    if (!prompt) return;
    setLoading(true); setResult(""); setImageUrl(""); setAuditScore(null);
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('context', brandContext);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await axios.post(`${API_URL}/generate-visual`, formData, { 
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const url = URL.createObjectURL(response.data);
      setImageUrl(url);
      if(selectedFile) setResult("✨ Image generated using your Style Reference.");
    } catch (error) { setResult("Error generating visual."); } 
    finally { setLoading(false); }
  };

  // 3. Brand Guardian (Strict Audit)
  const runAudit = async () => {
    if (!prompt) return;
    setLoading(true); setResult(""); setImageUrl(""); setAuditScore(null);
    try {
      const response = await axios.post(`${API_URL}/audit-content`, {
          content_to_audit: prompt,
          context: brandContext
      });
      
      try {
          // Parse the JSON coming from the backend
          const data = JSON.parse(response.data.response);
          setAuditScore(data.overall_score);
          
          const formattedResult = `
### **Brand Score: ${data.overall_score}/100**
**Tone Score:** ${data.tone_score}/100

**Detailed Breakdown:**
${data.rubric_breakdown.map((item: string) => `- ${item}`).join('\n')}

**Suggestions:**
${data.improvement_suggestions}
          `;
          setResult(formattedResult);
      } catch (e) {
          // Fallback if AI output wasn't perfect JSON
          setResult(response.data.response);
      }
    } catch (error) { setResult("Error auditing content."); } 
    finally { setLoading(false); }
  };

  const handleGenerate = () => {
    if (activeTab === 'writer') return runWriter();
    if (activeTab === 'visual') return runVisual();
    if (activeTab === 'guardian') return runAudit();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          // If in Writer/Guardian, file is for CONTEXT
          if (activeTab !== 'visual') {
              handleContextExtraction(file);
          } else {
              // In Visual, file is a STYLE REFERENCE
              setSelectedFile(file);
          }
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-4xl w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-white p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
                <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">BrandGenius <span className="text-indigo-600">Enterprise</span></h1>
          </div>
          <button 
            onClick={() => setShowContext(!showContext)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-2 rounded-lg ${showContext ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings className="w-4 h-4" />
            {showContext ? "Close Strategy" : "Brand Strategy"}
          </button>
        </div>

        {/* CONTEXT BUILDER */}
        {showContext && (
            <div className="bg-slate-50 p-6 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {[
                        { l: "Role", v: selectedRole, s: setSelectedRole, o: ROLES },
                        { l: "Industry", v: selectedIndustry, s: setSelectedIndustry, o: INDUSTRIES },
                        { l: "Tone", v: selectedTone, s: setSelectedTone, o: TONES },
                        { l: "Visuals", v: selectedStyle, s: setSelectedStyle, o: STYLES }
                    ].map((f, i) => (
                        <div key={i}>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{f.l}</label>
                            <div className="relative">
                                <select value={f.v} onChange={(e) => f.s(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none">
                                    {f.o.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-3 h-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    ))}
                </div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Resulting System Instruction (Editable)
                </label>
                <textarea 
                    value={brandContext}
                    onChange={(e) => setBrandContext(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm text-slate-600 h-20 focus:ring-2 focus:ring-indigo-500 outline-none font-mono bg-white"
                />
            </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-white">
          <button onClick={() => { setActiveTab('writer'); setSelectedFile(null); }} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'writer' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <PenTool className="w-4 h-4" /> Campaign Writer
          </button>
          <button onClick={() => { setActiveTab('visual'); setSelectedFile(null); }} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'visual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <ImageIcon className="w-4 h-4" /> Visual Studio
          </button>
          <button onClick={() => { setActiveTab('guardian'); setSelectedFile(null); }} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'guardian' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <ShieldCheck className="w-4 h-4" /> Brand Guardian
          </button>
        </div>

        {/* Main Workspace */}
        <div className="p-6">
          <div className="relative">
            <textarea
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-40 mb-3 text-slate-700 placeholder:text-slate-400 text-lg"
              placeholder={
                  activeTab === 'writer' ? "e.g. Write a 3-part email sequence for our new summer line..." : 
                  activeTab === 'visual' ? "e.g. A minimal product shot on a concrete pedestal..." :
                  "Paste existing content (text) here to audit it against your brand guidelines..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
                 <div className="flex gap-2">
                    <input type="file" id="file-upload" className="hidden" onChange={onFileSelected} accept={activeTab === 'visual' ? "image/*" : ".pdf,.txt,.md"} />
                    <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-2 px-3 rounded-md bg-slate-100 hover:bg-indigo-50">
                      <Upload className="w-3 h-3" />
                      {activeTab === 'visual' ? "Upload Style Ref Image" : "Import Context (PDF/Txt)"}
                    </label>
                 </div>

                 {selectedFile && (
                    <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-100 animate-in fade-in zoom-in duration-200">
                      <span className="max-w-[150px] truncate">{selectedFile.name}</span>
                      <button onClick={removeFile} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
                    </div>
                 )}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-indigo-200"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 
             (activeTab === 'guardian' ? "Audit Content" : "Generate")}
          </button>
        </div>

        {/* Output */}
        {(result || imageUrl) && (
          <div className="bg-slate-50 p-8 border-t border-slate-100 min-h-[200px]">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              {activeTab === 'guardian' ? "Audit Report" : "Output"}
            </h3>

            {/* NEW: Audit Score Visualizer */}
            {activeTab === 'guardian' && auditScore !== null && (
                <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-slate-600">Brand Compliance Score</span>
                        <span className={`text-2xl font-bold ${
                            auditScore >= 90 ? 'text-green-600' : 
                            auditScore >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                            {auditScore}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out ${
                                auditScore >= 90 ? 'bg-green-500' : 
                                auditScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${auditScore}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-right">
                        {auditScore >= 90 ? "Excellent. Ready to publish." : 
                         auditScore >= 70 ? "Good. Minor tweaks needed." : 
                         "Needs Revision. Off-brand detected."}
                    </p>
                </div>
            )}
            
            {result && (
              <div className="prose prose-slate prose-lg text-slate-700 leading-relaxed max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}

            {imageUrl && (
              <div className="rounded-xl overflow-hidden shadow-md border border-slate-200">
                <img src={imageUrl} alt="Generated" className="w-full h-auto" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;