import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Upload, X, FileText } from 'lucide-react';

// Your actual Cloud Run URL
const API_URL = "https://brand-genius-app-186356869150.europe-west2.run.app";

function App() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [imageUrl, setImageUrl] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  // --- HELPER: Upload File First (If exists) ---
  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    console.log("Uploading brand context...");
    const formData = new FormData();
    formData.append('file', selectedFile);

    // Send to the dedicated upload endpoint
    await axios.post(`${API_URL}/upload-brand-assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  };

  // --- TEXT GENERATION ---
  const generateCopy = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(""); 
    setImageUrl(""); 
    
    try {
      // Step 1: Inject Context (if file is selected)
      if (selectedFile) {
        await handleFileUpload();
      }

      // Step 2: Generate Copy (The backend now reads from its memory)
      // Note: We send simple JSON now, not FormData
      const response = await axios.post(`${API_URL}/generate-copy`, {
          prompt: prompt
      });
      
      // Backend returns { "response": "..." }
      setResult(response.data.response);

    } catch (error) {
      console.error(error);
      setResult("Error generating text. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  // --- IMAGE GENERATION ---
  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult("");
    setImageUrl("");
    
    try {
      // Step 1: Inject Context (if file is selected)
      if (selectedFile) {
        await handleFileUpload();
      }

      // Step 2: Generate Image
      const response = await axios.post(`${API_URL}/generate-image`, { 
        prompt: prompt 
      }, { 
        responseType: 'blob' // Critical for receiving image bytes
      });

      const url = URL.createObjectURL(response.data);
      setImageUrl(url);

    } catch (error) {
      console.error(error);
      setResult("Error generating image. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-2xl w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-white p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">BrandGenius Enterprise</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ✍️ Copywriter
          </button>
          <button 
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'image' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🎨 Art Studio
          </button>
        </div>

        {/* Input Area */}
        <div className="p-6">
          <div className="relative">
            <textarea
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32 mb-3 text-slate-700 placeholder:text-slate-400"
              placeholder={activeTab === 'text' ? "e.g., Write a LinkedIn post..." : "e.g., A futuristic coffee shop..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            
            {/* File Upload UI */}
            <div className="flex items-center justify-between mb-4">
                 <div className="flex gap-2">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".txt,.md" // Limit to text files for the demo
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors py-2 px-3 rounded-md hover:bg-slate-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{activeTab === 'text' ? "Attach Brand Voice (.txt)" : "Attach Style Guide (.txt)"}</span>
                    </label>
                 </div>

                 {selectedFile && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-100">
                      <FileText className="w-3 h-3" />
                      <span className="max-w-[150px] truncate">{selectedFile.name}</span>
                      <button onClick={removeFile} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                 )}
            </div>
          </div>

          <button
            onClick={activeTab === 'text' ? generateCopy : generateImage}
            disabled={loading || !prompt}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (activeTab === 'text' ? "Generate Text" : "Generate Visual")}
          </button>
        </div>

        {/* Results Area */}
        {(result || imageUrl) && (
          <div className="bg-slate-50 p-6 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {imageUrl ? "Generated Asset" : "Generated Strategy"}
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