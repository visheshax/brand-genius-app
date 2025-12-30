import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Upload, X, Image as ImageIcon, ShoppingBag, Settings, ChevronDown } from 'lucide-react';

// Your Cloud Run URL
const API_URL = "https://brand-genius-app-186356869150.europe-west2.run.app";

// --- OPTIONS FOR THE BUILDER ---
const ROLES = ["Brand Strategist", "Marketing Executive", "Social Media Manager", "Copywriting Expert", "SEO Specialist"];
const INDUSTRIES = ["Tech & SaaS", "Fashion & Apparel", "Food & Beverage", "Healthcare", "Real Estate", "Finance", "Gaming"];
const TONES = ["Professional & Trustworthy", "Witty & Fun", "Urgent & Sales-heavy", "Empathetic & Warm", "Luxury & Minimalist", "Gen-Z & Trendy"];
const STYLES = ["Clean & Modern", "Cyberpunk & Neon", "Vintage & Retro", "Luxury & Gold", "Pastel & Soft", "Corporate & Blue"];

function App() {
  // --- STATE ---
  const [prompt, setPrompt] = useState("");
  
  // BUILDER STATE (Dropdowns)
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0]);
  const [selectedTone, setSelectedTone] = useState(TONES[0]);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);

  // THE FINAL CONTEXT STRING
  const [brandContext, setBrandContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  
  const [result, setResult] = useState("");
  const [imageUrl, setImageUrl] = useState(""); 
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'product'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // --- EFFECT: AUTO-BUILD CONTEXT ---
  // Whenever a dropdown changes, we rewrite the context string automatically.
  useEffect(() => {
    const builtContext = `You are a world-class ${selectedRole} for a ${selectedIndustry} company. Your tone of voice is ${selectedTone}. The visual brand identity is ${selectedStyle}.`;
    setBrandContext(builtContext);
  }, [selectedRole, selectedIndustry, selectedTone, selectedStyle]);

  // --- HANDLERS ---
  const removeFile = () => {
    setSelectedFile(null);
  };

  // --- CONTEXT EXTRACTION ---
  const handleContextExtraction = async (file: File) => {
    setLoading(true);
    try {
        console.log("Extracting context from file...");
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API_URL}/extract-context-from-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.status === "success") {
            // Note: This will overwrite the dropdown generated text
            setBrandContext(response.data.extracted_text);
            setShowContext(true); 
            alert("Brand Guidelines extracted! (Note: Changing dropdowns now will overwrite this)");
        }
    } catch (error) {
        console.error("Extraction failed", error);
        alert("Could not read file. Ensure it is a text file.");
    } finally {
        setLoading(false);
        setSelectedFile(null);
    }
  };

  // --- API CALLS ---
  const generateCopy = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(""); 
    setImageUrl(""); 
    
    try {
      const response = await axios.post(`${API_URL}/generate-copy`, {
          prompt: prompt,
          context: brandContext
      });
      setResult(response.data.response);
    } catch (error) {
      console.error(error);
      setResult("Error generating text.");
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult("");
    setImageUrl("");
    
    try {
      const response = await axios.post(`${API_URL}/generate-image`, { 
        prompt: prompt,
        context: brandContext
      }, { responseType: 'blob' });

      const url = URL.createObjectURL(response.data);
      setImageUrl(url);
    } catch (error) {
      console.error(error);
      setResult("Error generating image.");
    } finally {
      setLoading(false);
    }
  };

  const generateProductImage = async () => {
    if (!prompt || !selectedFile) {
        alert("Please select a product image and enter a prompt.");
        return;
    }
    setLoading(true);
    setResult("");
    setImageUrl("");

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('prompt', prompt);
        formData.append('context', brandContext);

        const response = await axios.post(`${API_URL}/swap-background`, formData, {
            responseType: 'blob', 
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        const url = URL.createObjectURL(response.data);
        setImageUrl(url);
    } catch (error) {
        console.error(error);
        setResult("Error swapping background.");
    } finally {
        setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (activeTab === 'text') return generateCopy();
    if (activeTab === 'image') return generateImage();
    if (activeTab === 'product') return generateProductImage();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (activeTab !== 'product') {
              handleContextExtraction(file);
          } else {
              setSelectedFile(file);
          }
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-3xl w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-white p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
                <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">BrandGenius Enterprise</h1>
          </div>
          <button 
            onClick={() => setShowContext(!showContext)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-2 rounded-lg ${showContext ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings className="w-4 h-4" />
            {showContext ? "Close Settings" : "Configure Brand"}
          </button>
        </div>

        {/* BRAND CONTEXT BUILDER (New Modular Design) */}
        {showContext && (
            <div className="bg-slate-50 p-6 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
                
                {/* 1. Dropdown Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Act As</label>
                        <div className="relative">
                            <select 
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Industry</label>
                        <div className="relative">
                            <select 
                                value={selectedIndustry}
                                onChange={(e) => setSelectedIndustry(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Brand Tone</label>
                        <div className="relative">
                            <select 
                                value={selectedTone}
                                onChange={(e) => setSelectedTone(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Visual Style</label>
                        <div className="relative">
                            <select 
                                value={selectedStyle}
                                onChange={(e) => setSelectedStyle(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* 2. Generated Prompt Preview (Editable) */}
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Resulting System Instruction (Editable)
                </label>
                <textarea 
                    value={brandContext}
                    onChange={(e) => setBrandContext(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm text-slate-700 h-20 focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                />
            </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => { setActiveTab('text'); setSelectedFile(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ✍️ Copywriter
          </button>
          <button 
            onClick={() => { setActiveTab('image'); setSelectedFile(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'image' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🎨 Art Studio
          </button>
          <button 
            onClick={() => { setActiveTab('product'); setSelectedFile(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'product' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🛍️ Product Studio
          </button>
        </div>

        {/* Input Area */}
        <div className="p-6">
          <div className="relative">
            <textarea
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32 mb-3 text-slate-700 placeholder:text-slate-400"
              placeholder={
                  activeTab === 'text' ? "e.g., Write a LinkedIn post about our new launch..." : 
                  activeTab === 'image' ? "e.g., A busy street scene with our logo..." :
                  "e.g., On a marble podium, soft luxury lighting..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            
            {/* Dynamic File Upload UI */}
            <div className="flex items-center justify-between mb-4">
                 <div className="flex gap-2">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={onFileSelected}
                      accept={activeTab === 'product' ? "image/*" : ".txt,.md"} 
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors py-2 px-3 rounded-md hover:bg-slate-50"
                    >
                      {activeTab === 'product' ? <ImageIcon className="w-4 h-4"/> : <Upload className="w-4 h-4" />}
                      <span>
                        {activeTab === 'product' ? "Upload Product Photo (Required)" : "Import Brand Guide (.txt)"}
                      </span>
                    </label>
                 </div>

                 {selectedFile && activeTab === 'product' && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-100">
                      <ShoppingBag className="w-3 h-3" />
                      <span className="max-w-[150px] truncate">{selectedFile.name}</span>
                      <button onClick={removeFile} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                 )}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt || (activeTab === 'product' && !selectedFile)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 
             (activeTab === 'product' ? "Swap Background" : "Generate")}
          </button>
        </div>

        {/* Results Area */}
        {(result || imageUrl) && (
          <div className="bg-slate-50 p-6 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Generated Result
            </h3>
            
            {result && (
              <div className="prose prose-slate text-slate-700 leading-relaxed max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}

            {imageUrl && (
              <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200">
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