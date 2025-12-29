import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Upload, X, FileText } from 'lucide-react';

// If we are on Vercel, use the Env Var. If on localhost, use 8000.
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

  const generateCopy = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(""); 
    setImageUrl(""); 
    
    try {
      let response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('file', selectedFile);
        formData.append('context', "Professional marketing tone");
        response = await axios.post(`${API_URL}/generate/copy-with-file`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await axios.post(`${API_URL}/generate/copy`, {
            prompt: prompt,
            context: "Professional marketing tone"
        });
      }
      setResult(response.data.result);
    } catch (error) {
      console.error(error);
      setResult("Error generating text.");
    } finally {
      setLoading(false);
    }
  };

  // --- UPDATED FUNCTION: Handle Files for Images too ---
  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult("");
    setImageUrl("");
    
    try {
      let response;
      
      // We now use FormData for images too, in case a file is attached
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('style', "minimalist, 4k, professional");
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      // Note: We use the same endpoint, but now it accepts Form Data
      response = await axios.post(`${API_URL}/generate/image`, formData, { 
        responseType: 'blob', // Important for images
        headers: { 'Content-Type': 'multipart/form-data' } // Important for files
      });

      const url = URL.createObjectURL(response.data);
      setImageUrl(url);
    } catch (error) {
      console.error(error);
      setResult("Error generating image.");
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
            
            {/* --- MOVED: File Upload is now visible for BOTH tabs --- */}
            <div className="flex items-center justify-between mb-4">
                 <div className="flex gap-2">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.txt"
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors py-2 px-3 rounded-md hover:bg-slate-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{activeTab === 'text' ? "Attach Guidelines" : "Attach Style Ref"}</span>
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
