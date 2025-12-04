import { useState, useRef, useEffect } from "react";
import { uploadFile, generateSofaWithFabric, uploadFromUrl, addToHistory, getHistory } from "@/api/localServices";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, Wand2, Download, RefreshCw, Sparkles, Loader2, AlertCircle, History, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MashupGenerator() {
  const [tissuImage, setTissuImage] = useState(null);
  const [tissuPreview, setTissuPreview] = useState(null);
  const [canapeImage, setCanapeImage] = useState(null);
  const [canapePreview, setCanapePreview] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [error, setError] = useState(null);
  const [dragOverTissu, setDragOverTissu] = useState(false);
  const [dragOverCanape, setDragOverCanape] = useState(false);
  const [userDetails, setUserDetails] = useState("");
  const [history, setHistory] = useState([]);
  const [cloudinaryUrl, setCloudinaryUrl] = useState(null);

  const tissuCameraRef = useRef(null);
  
  // Charger l'historique au démarrage
  useEffect(() => {
    setHistory(getHistory());
  }, []);
  const tissuGalleryRef = useRef(null);
  const canapeCameraRef = useRef(null);
  const canapeGalleryRef = useRef(null);

  const handleFileSelect = (file, type) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'tissu') {
        setTissuImage(file);
        setTissuPreview(reader.result);
      } else {
        setCanapeImage(file);
        setCanapePreview(reader.result);
      }
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragEnter = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'tissu') {
      setDragOverTissu(true);
    } else {
      setDragOverCanape(true);
    }
  };

  const handleDragLeave = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'tissu') {
      setDragOverTissu(false);
    } else {
      setDragOverCanape(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (type === 'tissu') {
      setDragOverTissu(false);
    } else {
      setDragOverCanape(false);
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handleFileSelect(file, type);
      } else {
        setError("Veuillez déposer un fichier image (JPG, PNG, etc.)");
      }
    }
  };

  const handleGenerateMashup = async () => {
    if (!tissuImage || !canapeImage) {
      setError("Veuillez sélectionner une photo de tissu et une photo de canapé");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setGenerationProgress("📤 Upload des images...");

    try {
      // Upload des images vers Cloudinary
      const canapeUpload = await uploadFile(canapeImage);
      const canapeUrl = canapeUpload.file_url;
      
      const tissuUpload = await uploadFile(tissuImage);
      const tissuUrl = tissuUpload.file_url;

      setGenerationProgress("🎨 Génération avec Nano-Banana-Pro...");

      // Appel à Replicate via notre API avec polling
      const result = await generateSofaWithFabric({
        sofaImageUrl: canapeUrl,
        fabricImageUrl: tissuUrl,
        userDetails: userDetails,
        onProgress: (msg) => setGenerationProgress(msg)
      });

      if (result.status === "error") {
        throw new Error(result.message);
      }

      setGeneratedImage(result.imageUrl);
      setGenerationProgress("💾 Sauvegarde sur Cloudinary...");

      // Upload sur Cloudinary et sauvegarder dans l'historique
      try {
        const cloudinaryResult = await uploadFromUrl(result.imageUrl);
        setCloudinaryUrl(cloudinaryResult.imageUrl);
        
        const newHistory = addToHistory({
          imageUrl: cloudinaryResult.imageUrl,
          thumbnailUrl: cloudinaryResult.thumbnailUrl,
          userDetails: userDetails,
        });
        setHistory(newHistory);
      } catch (uploadErr) {
        console.error("Erreur sauvegarde Cloudinary:", uploadErr);
        // On continue quand même, l'image est affichée
      }

      setGenerationProgress("✅ Terminé !");
      
    } catch (err) {
      console.error("Erreur:", err);
      setError(err.message || "Erreur lors de la génération. Vérifiez que les fonctions backend sont activées dans Dashboard > Settings.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (imageUrl = null) => {
    const urlToDownload = imageUrl || cloudinaryUrl || generatedImage;
    if (!urlToDownload) return;
    
    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `canape-mashup-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur de téléchargement:", err);
    }
  };

  const handleReset = () => {
    setTissuImage(null);
    setTissuPreview(null);
    setCanapeImage(null);
    setCanapePreview(null);
    setGeneratedImage(null);
    setError(null);
    setGenerationProgress("");
    setUserDetails("");
    setCloudinaryUrl(null);
  };

  const handleSelectFromHistory = (item) => {
    setGeneratedImage(item.imageUrl);
    setCloudinaryUrl(item.imageUrl);
    if (item.userDetails) {
      setUserDetails(item.userDetails);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3">
            France Canapé
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Visualisez instantanément votre canapé avec le tissu de votre choix
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            Propulsé par Nano-Banana-Pro AI
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card 
            className={`border-2 bg-white/80 backdrop-blur shadow-xl hover:shadow-2xl transition-all duration-300 ${
              dragOverTissu ? 'border-blue-500 bg-blue-50 scale-105' : 'border-blue-200'
            }`}
            onDragEnter={(e) => handleDragEnter(e, 'tissu')}
            onDragLeave={(e) => handleDragLeave(e, 'tissu')}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'tissu')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Tissu</h2>
              </div>

              {tissuPreview ? (
                <div className="mb-6 relative group">
                  <img
                    src={tissuPreview}
                    alt="Aperçu tissu"
                    className="w-full h-64 object-cover rounded-xl shadow-lg"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 rounded-xl" />
                </div>
              ) : (
                <div className={`mb-6 h-64 rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                  dragOverTissu 
                    ? 'border-blue-500 bg-blue-100 scale-105' 
                    : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300'
                }`}>
                  <div className="text-center">
                    <Upload className={`w-12 h-12 mx-auto mb-2 ${dragOverTissu ? 'text-blue-600' : 'text-blue-400'}`} />
                    <p className="text-sm text-gray-500">
                      {dragOverTissu ? 'Déposez votre image ici' : 'Aucun tissu sélectionné'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Glissez-déposez une image</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <input
                  ref={tissuCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileSelect(e.target.files[0], 'tissu')}
                  className="hidden"
                />
                <Button
                  onClick={() => tissuCameraRef.current?.click()}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
                  size="lg"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Prendre une photo du tissu
                </Button>

                <input
                  ref={tissuGalleryRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files[0], 'tissu')}
                  className="hidden"
                />
                <Button
                  onClick={() => tissuGalleryRef.current?.click()}
                  variant="outline"
                  className="w-full border-2 border-blue-200 hover:bg-blue-50"
                  size="lg"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Choisir depuis la photothèque
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`border-2 bg-white/80 backdrop-blur shadow-xl hover:shadow-2xl transition-all duration-300 ${
              dragOverCanape ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-indigo-200'
            }`}
            onDragEnter={(e) => handleDragEnter(e, 'canape')}
            onDragLeave={(e) => handleDragLeave(e, 'canape')}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'canape')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Canapé</h2>
              </div>

              {canapePreview ? (
                <div className="mb-6 relative group">
                  <img
                    src={canapePreview}
                    alt="Aperçu canapé"
                    className="w-full h-64 object-cover rounded-xl shadow-lg"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 rounded-xl" />
                </div>
              ) : (
                <div className={`mb-6 h-64 rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                  dragOverCanape 
                    ? 'border-indigo-500 bg-indigo-100 scale-105' 
                    : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300'
                }`}>
                  <div className="text-center">
                    <Upload className={`w-12 h-12 mx-auto mb-2 ${dragOverCanape ? 'text-indigo-600' : 'text-indigo-400'}`} />
                    <p className="text-sm text-gray-500">
                      {dragOverCanape ? 'Déposez votre image ici' : 'Aucun canapé sélectionné'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Glissez-déposez une image</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <input
                  ref={canapeCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileSelect(e.target.files[0], 'canape')}
                  className="hidden"
                />
                <Button
                  onClick={() => canapeCameraRef.current?.click()}
                  className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg"
                  size="lg"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Prendre une photo du canapé
                </Button>

                <input
                  ref={canapeGalleryRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files[0], 'canape')}
                  className="hidden"
                />
                <Button
                  onClick={() => canapeGalleryRef.current?.click()}
                  variant="outline"
                  className="w-full border-2 border-indigo-200 hover:bg-indigo-50"
                  size="lg"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Choisir depuis la photothèque
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Champ détails supplémentaires */}
        <div className="max-w-2xl mx-auto mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💡 Détails supplémentaires (optionnel)
          </label>
          <textarea
            value={userDetails}
            onChange={(e) => setUserDetails(e.target.value)}
            placeholder="Ex: couleur camel, blanc éclatant, texture velours..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all resize-none"
            rows={2}
          />
          <p className="text-xs text-gray-400 mt-1">
            Ajoutez des précisions sur la couleur ou la texture souhaitée
          </p>
        </div>

        <div className="text-center mb-8">
          {!isGenerating ? (
            <Button
              onClick={handleGenerateMashup}
              disabled={!tissuImage || !canapeImage}
              className="px-12 py-6 text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:from-purple-600 hover:via-pink-600 hover:to-red-600 text-white shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
              size="lg"
            >
              <Wand2 className="w-6 h-6 mr-3" />
              Générer avec IA
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="text-lg font-medium">{generationProgress}</span>
              </div>
              <p className="text-sm text-gray-500">
                ⏱️ Cela peut prendre 1-2 minutes
              </p>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-8 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {generatedImage && (
          <Card className="bg-white/80 backdrop-blur shadow-2xl border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Résultat</h2>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    className="border-2 border-green-200 hover:bg-green-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="border-2 border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Nouveau
                  </Button>
                </div>
              </div>

              <div className="relative group">
                <img
                  src={generatedImage}
                  alt="Mashup généré"
                  className="w-full rounded-xl shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl" />
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 text-center">
                  ✨ Votre canapé personnalisé est prêt !
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historique */}
        {history.length > 0 && (
          <Card className="mt-8 bg-white/80 backdrop-blur shadow-xl border-2 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5 text-gray-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Historique</h2>
                <span className="text-sm text-gray-500">({history.length} images)</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="relative group cursor-pointer"
                    onClick={() => handleSelectFromHistory(item)}
                  >
                    <img
                      src={item.thumbnailUrl}
                      alt="Historique"
                      className="w-full aspect-square object-cover rounded-lg shadow-md group-hover:shadow-xl transition-all duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-lg flex items-center justify-center">
                      <Download 
                        className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item.imageUrl);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}