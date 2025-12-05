# 🛋️ France Canapé - Visualiseur de Canapé avec Tissu IA

Visualisez instantanément votre canapé avec le tissu de votre choix grâce à l'IA.

## À propos

France Canapé est une application web qui utilise l'IA (Nano-Banana-Pro via Replicate) pour générer des images photoréalistes de canapés avec des tissus personnalisés. Téléchargez votre photo de canapé et votre tissu préféré, et découvrez le rendu final en quelques secondes.

## Caractéristiques

- 📸 Upload de photos (canapé + tissu)
- 🎨 Génération IA en temps réel
- 💾 Stockage des résultats sur Cloudinary
- 📱 Interface responsive
- ✅ Historique des générations (localStorage)
- 🚀 Déploiement sur Vercel

## Stack Technique

- **Frontend** : React 18 + Vite
- **UI Components** : Shadcn/ui + Radix UI
- **Styling** : Tailwind CSS
- **Stockage images** : Cloudinary
- **Génération IA** : Replicate API (Nano-Banana-Pro)
- **Hosting** : Vercel

## Installation & Démarrage

### Développement local
npm install
npm run dev

L'app sera accessible sur http://localhost:5173

### Build production
npm run build
npm run preview   # prévisualiser le build


### Architecture
pages — Pages principales (MashupGenerator, Layout)
ui — Composants réutilisables
localServices.js — Fonctions pour Cloudinary + Replicate
replicate.js — Endpoint serverless Vercel pour Replicate


### Comment ça marche
L'utilisateur upload 2 images (canapé + tissu)
Les images sont converties en Data URLs (base64)
Envoyées au backend via /api/replicate
Replicate génère l'image finale (canapé + tissu fusionnés)
L'image finale est sauvegardée sur Cloudinary
L'historique est stocké en localStorage


### Déploiement
L'app est déployée automatiquement sur Vercel à chaque push sur main :

Repo : https://github.com/webmasterfrancecanape-a11y/mashup_prod
URL : Configurée dans Vercel

### Variables d'environnement
Créer un fichier .env.local (dev local) :
REPLICATE_API_TOKEN=votre_token_replicate
# Test build auto
