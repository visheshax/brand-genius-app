import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Upload, X, FileText, Image as ImageIcon, ShoppingBag, Settings } from 'lucide-react';

// Your Cloud Run URL
const API_URL = "https://brand-genius-app-186356869150.europe-west2.run.app";

function App() {
  // --- STATE ---
  const [prompt, setPrompt] = useState("");
  // STATELESS: The frontend now holds the memory
  const [brandContext, setBrandContext] = useState("You are a helpful, professional brand strategist. Visual style is clean and modern.");
  const [showContext, setShowContext] = useState(false); // Toggle to hide/show context box
  
  const [result, setResult] = useState("");
  const [imageUrl, setImageUrl] = useState(""); 
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'product'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // --- HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  // --- CONTEXT EXTRACTION (Stateless) ---
  // Uploads file, gets text BACK, and puts it in the 'brandContext' box
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
            setBrandContext(response.data.extracted_text);
            setShowContext(true); // Auto-open the box to show user what happened
            alert("Brand Guidelines extracted successfully!");
        }
    } catch (error) {
        console.error("Extraction failed", error);
        alert("Could not read file. Ensure it is a text file.");
    } finally {
        setLoading(false);
        setSelectedFile(null); // Clear file after extraction
    }
  };

  // --- TEXT GENERATION ---
  const generateCopy = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(""); 
    setImageUrl(""); 
    
    try {
      // Send BOTH prompt AND context
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

  // --- STANDARD IMAGE GENERATION ---
  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult("");
    setImageUrl("");
    
    try {
      // Send BOTH prompt AND context
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

  // --- PRODUCT BACKGROUND SWAP ---
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
        formData.append('context', brandContext); // Send context here too

        const response = await axios.post(`${API_URL}/swap-background`, formData, {
            responseType: 'blob', 
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        const url = URL.createObjectURL(response.data);
        setImageUrl(url);
    } catch (error) {
        console.error(error);
        setResult("Error swapping background. Ensure image is valid.");
    } finally {
        setLoading(false);
    }
  };

  // Decide which function to call
  const handleGenerate = () => {
    if (activeTab === 'text') return generateCopy();
    if (activeTab === 'image') return generateImage();
    if (activeTab === 'product') return generateProductImage();
  };

  // Handle file selection logic based on tab
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          
          // If we are in text/image mode, uploading a file means "Extract Context"
          if (activeTab !== 'product') {
              handleContextExtraction(file);
          } else {
              // In product mode, uploading a file means "Select Product Image"
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
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            {showContext ? "Hide Brand Context" : "Edit Brand Context"}
          </button>
        </div>

        {/* BRAND CONTEXT PANEL (Collapsible) */}
        {showContext && (
            <div className="bg-slate-50 p-6 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Global Brand Context (Applied to all generations)
                </label>
                <textarea 
                    value={brandContext}
                    onChange={(e) => setBrandContext(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm text-slate-700 h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. We are a sustainable coffee brand. Tone is warm, earthy, and premium..."
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
                  activeTab === 'text' ? "e.g., Write a LinkedIn post..." : 
                  activeTab === 'image' ? "e.g., A futuristic coffee shop..." :
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
                      // Switch accept types based on tab
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