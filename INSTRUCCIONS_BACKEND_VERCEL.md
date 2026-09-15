# Guia per solucionar el Backend a Vercel (`backend-opos-tests`)

Si quan puges la teva app a GitHub Pages o fas consultes a la IA et surt l'error 404 a `https://backend-opos-tests.vercel.app/api/chat`, aquí tens el motiu exacte i com solucionar-ho en 2 minuts al teu repositori `https://github.com/todopropi/backend-opos-tests`.

---

## 🔍 Per què donava 404 a Vercel?

A les teves imatges es veu que dins del repositori de GitHub:
1. El fitxer `package.json` està dins de la carpeta `/api/package.json` en comptes d'estar a l'arrel `/package.json`.
2. Vercel busca el `package.json` a l'arrel (`/`) per saber quines dependències instal·lar (`@google/generative-ai`) i si el projecte utilitza mòduls ESM (`"type": "module"`). Com que no el troba a l'arrel, no desplega la funció `api/chat.js` o falla la compilació.
3. Falta el fitxer de configuració de rutes `vercel.json`.

---

## 🛠️ Com arreglar-ho al teu repositori `todopropi/backend-opos-tests`:

L'estructura del teu repositori a GitHub ha de ser exactament aquesta:

```text
backend-opos-tests/
├── api/
│   └── chat.js
├── package.json
├── vercel.json
└── README.md
```

### 1. Fitxer `package.json` (A L'ARREL DEL REPOSITORI)
Crea o mou el fitxer `package.json` a l'arrel del teu repositori amb aquest contingut:

```json
{
  "name": "backend-opos-tests",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node api/chat.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.0"
  }
}
```

### 2. Fitxer `vercel.json` (A L'ARREL DEL REPOSITORI)
Crea aquest fitxer a l'arrel:

```json
{
  "version": 2,
  "routes": [
    {
      "src": "/api/chat",
      "dest": "/api/chat.js"
    },
    {
      "src": "/(.*)",
      "dest": "/api/chat.js"
    }
  ]
}
```

### 3. Fitxer `api/chat.js`
Assegura't que el teu fitxer `api/chat.js` tingui aquest codi complet que accepta tant el format `{ prompt }` com `{ message }` i suporta múltiples models de Gemini amb fallback automàtic:

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Desactivar memòria cau per a respostes dinàmiques
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Capçaleres CORS perquè funcioni des de GitHub Pages i qualsevol domini
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Respondre a la pre-comprovació OPTIONS del navegador
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta la variable d'entorn GEMINI_API_KEY a la configuració del teu projecte a Vercel (Project Settings -> Environment Variables)."
    });
  }

  // Obtenir el text de la consulta
  const prompt = (req.body && (req.body.prompt || req.body.message || req.body.missatge)) 
    || req.query.prompt 
    || req.query.q 
    || '';

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Falta el prompt o consulta a realitzar." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Models per ordre de prioritat recomanats per Google
    const models = [
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash'
    ];

    let respostaText = null;
    let ultimError = null;

    for (const modelNom of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelNom });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        respostaText = response.text();
        if (respostaText) break;
      } catch (err) {
        console.warn(`Model ${modelNom} ha fallat, provant següent...`, err.message);
        ultimError = err;
      }
    }

    if (respostaText) {
      return res.status(200).json({
        text: respostaText,
        resposta: respostaText,
        status: "success"
      });
    }

    throw ultimError || new Error("No s'ha pogut obtenir resposta de cap model de Gemini.");
  } catch (error) {
    console.error("Error en l'execució de Gemini:", error);
    return res.status(500).json({
      error: error.message || "Error intern processant la petició amb Gemini."
    });
  }
}
```

### 4. A Vercel (Panell de Control)
1. Ves al teu projecte `backend-opos-tests` a [vercel.com](https://vercel.com).
2. Fes clic a **Settings** > **Environment Variables**.
3. Afegeix la variable:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** *La teva clau d'API de Google AI Studio*
4. Fes un nou desplegament (Redeploy) o fes un `git push` a GitHub perquè Vercel apliqui els canvis.

Un cop fet això, la URL `https://backend-opos-tests.vercel.app/api/chat` respondrà directament i la IA funcionarà sense cap 404 tant al teu GitHub com a qualsevol dispositiu!
